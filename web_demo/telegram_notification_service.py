# -*- coding: utf-8 -*-
"""
Telegram group notifications — chỉ gửi tin + link website; không webhook; không trừ kho.
Cấu hình: biến môi trường (không hard-code token).
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from database import (
    DbCustomer,
    DbDealer,
    DbJobCard,
    DbOffcutInventory,
    DbLotInventory,
    DbRequest,
    DbTelegramMessageLog,
    DbWorkstream,
    SessionLocal,
)

LOG = logging.getLogger("uvicorn.error")

BAD_TOKENS = frozenset(
    {"", "none", "null", "n/a", "unknown", "—", "-", "undefined"}
)


def _tz() -> str:
    return (os.environ.get("DYC_REPORT_TIMEZONE") or "Asia/Ho_Chi_Minh").strip()


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _clean_str(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    low = s.lower()
    if low in BAD_TOKENS:
        return ""
    return s


def _vin_last6(vin: Optional[str]) -> str:
    s = _clean_str(vin)
    if not s:
        return ""
    tail = re.sub(r"\s+", "", s)[-6:]
    return tail if tail else ""


def build_dyc_link(
    tab: str,
    request_id: Optional[str] = None,
    workstream_id: Optional[str] = None,
    job_card_id: Optional[str] = None,
    month: Optional[str] = None,
) -> str:
    base = (os.environ.get("DYC_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if not base:
        base = ""
    qs: List[str] = [f"tab={urllib.parse.quote(tab, safe='')}"]
    if request_id:
        qs.append(f"request_id={urllib.parse.quote(request_id, safe='')}")
    if workstream_id:
        qs.append(f"workstream_id={urllib.parse.quote(workstream_id, safe='')}")
    if job_card_id:
        qs.append(f"job_card_id={urllib.parse.quote(job_card_id, safe='')}")
    if month:
        qs.append(f"month={urllib.parse.quote(month, safe='')}")
    path = f"/?{'&'.join(qs)}"
    if base:
        return f"{base}{path}"
    return path or "/"


def format_optional_lines(lines: Sequence[Tuple[str, Any]]) -> List[str]:
    out: List[str] = []
    for label, val in lines:
        if val is None:
            continue
        if isinstance(val, (int, float)) and val == 0:
            continue
        s = _clean_str(val) if not isinstance(val, bool) else ("Có" if val else "")
        if not s:
            continue
        out.append(f"{label}: {s}")
    return out


def omit_empty_sections(sections: Dict[str, List[str]]) -> List[str]:
    parts: List[str] = []
    for title, lines in sections.items():
        clean = [ln for ln in lines if _clean_str(ln)]
        if not clean:
            continue
        if title:
            parts.append(title)
        parts.extend(clean)
    return parts


def _telegram_enabled() -> bool:
    return (os.environ.get("TELEGRAM_ENABLED") or "").strip().lower() in ("1", "true", "yes", "on")


def _telegram_creds() -> Tuple[str, str, str]:
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = (os.environ.get("TELEGRAM_GROUP_CHAT_ID") or "").strip()
    gname = (os.environ.get("TELEGRAM_GROUP_DISPLAY_NAME") or "DYC Vận hành Group").strip()
    return token, chat, gname


def _dedupe_sent_blocks(db: Session, dedupe_key: str) -> bool:
    row = (
        db.query(DbTelegramMessageLog)
        .filter(
            DbTelegramMessageLog.dedupe_key == dedupe_key,
            DbTelegramMessageLog.send_status == "SENT",
        )
        .first()
    )
    return row is not None


def _log_row(
    db: Session,
    *,
    event_type: str,
    dedupe_key: str,
    message_text: str,
    send_status: str,
    telegram_message_id: Optional[str] = None,
    error_message: Optional[str] = None,
    request_id: Optional[str] = None,
    workstream_id: Optional[str] = None,
    job_card_id: Optional[str] = None,
    telegram_group_name: str = "",
    telegram_chat_id: str = "",
    sent_at: Optional[str] = None,
) -> None:
    db.add(
        DbTelegramMessageLog(
            event_type=event_type,
            request_id=request_id,
            workstream_id=workstream_id,
            job_card_id=job_card_id,
            telegram_group_name=telegram_group_name or None,
            telegram_chat_id=telegram_chat_id or None,
            message_text=message_text,
            telegram_message_id=telegram_message_id,
            send_status=send_status,
            error_message=error_message,
            dedupe_key=dedupe_key,
            created_at=_now_iso(),
            sent_at=sent_at,
        )
    )
    db.commit()


def _http_send_message(token: str, chat_id: str, text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = json.dumps(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": False},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        data = json.loads(raw)
        if not data.get("ok"):
            return False, None, str(data.get("description") or data)
        mid = str((data.get("result") or {}).get("message_id") or "")
        return True, mid or None, None
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            err_body = str(e)
        return False, None, f"HTTP {e.code}: {err_body[:500]}"
    except Exception as e:
        return False, None, str(e)[:500]


class TelegramNotificationService:
    """Gửi thông báo Telegram + ghi DbTelegramMessageLog; lỗi gửi không làm fail nghiệp vụ."""

    @staticmethod
    def send_message_to_group(
        event_type: str,
        message_text: str,
        dedupe_key: str,
        request_id: Optional[str] = None,
        workstream_id: Optional[str] = None,
        job_card_id: Optional[str] = None,
    ) -> None:
        db = SessionLocal()
        try:
            token, chat_id, gname = _telegram_creds()
            if _dedupe_sent_blocks(db, dedupe_key):
                _log_row(
                    db,
                    event_type=event_type,
                    dedupe_key=dedupe_key,
                    message_text=message_text,
                    send_status="SKIPPED",
                    error_message="duplicate_sent",
                    request_id=request_id,
                    workstream_id=workstream_id,
                    job_card_id=job_card_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                )
                return

            if not _telegram_enabled():
                _log_row(
                    db,
                    event_type=event_type,
                    dedupe_key=dedupe_key,
                    message_text=message_text,
                    send_status="SKIPPED",
                    error_message="telegram_disabled",
                    request_id=request_id,
                    workstream_id=workstream_id,
                    job_card_id=job_card_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                )
                return

            if not token or not chat_id:
                _log_row(
                    db,
                    event_type=event_type,
                    dedupe_key=dedupe_key,
                    message_text=message_text,
                    send_status="SKIPPED",
                    error_message="missing_token_or_chat_id",
                    request_id=request_id,
                    workstream_id=workstream_id,
                    job_card_id=job_card_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                )
                return

            ok, mid, err = _http_send_message(token, chat_id, message_text)
            if ok:
                _log_row(
                    db,
                    event_type=event_type,
                    dedupe_key=dedupe_key,
                    message_text=message_text,
                    send_status="SENT",
                    telegram_message_id=mid,
                    request_id=request_id,
                    workstream_id=workstream_id,
                    job_card_id=job_card_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                    sent_at=_now_iso(),
                )
            else:
                _log_row(
                    db,
                    event_type=event_type,
                    dedupe_key=dedupe_key,
                    message_text=message_text,
                    send_status="FAILED",
                    error_message=err,
                    request_id=request_id,
                    workstream_id=workstream_id,
                    job_card_id=job_card_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                )
        except Exception as e:
            LOG.warning("telegram log/send failed: %s", e)
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()

    @staticmethod
    def _load_ws_req(db: Session, workstream_id: str) -> Tuple[Optional[DbWorkstream], Optional[DbRequest]]:
        ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == workstream_id).first()
        if not ws:
            return None, None
        req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
        return ws, req

    @staticmethod
    def _request_code(req: Optional[DbRequest]) -> str:
        if not req:
            return ""
        return _clean_str(getattr(req, "request_no", None)) or _clean_str(req.request_id)

    @staticmethod
    def _dealer_customer_lines(db: Session, req: Optional[DbRequest]) -> List[str]:
        if not req:
            return []
        lines: List[str] = []
        dealer_name = ""
        if _clean_str(req.dealer_id):
            d = db.query(DbDealer).filter(DbDealer.dealer_id == req.dealer_id).first()
            dealer_name = _clean_str(d.dealer_name) if d else ""
        if dealer_name:
            lines.append(f"Đại lý: {dealer_name}")
        cust = ""
        if _clean_str(req.customer_id):
            c = db.query(DbCustomer).filter(DbCustomer.customer_id == req.customer_id).first()
            cust = _clean_str(c.customer_name) if c else ""
        if not cust:
            cust = _clean_str(req.customer_name)
        if cust:
            if dealer_name:
                lines.append(f"Khách hàng: {cust}")
            else:
                lines.append(f"Khách hàng lẻ: {cust}")
        return lines

    @staticmethod
    def _sequence_line(req: Optional[DbRequest]) -> str:
        if not req:
            return ""
        a = _clean_str(getattr(req, "sequence_no", None))
        b = _clean_str(getattr(req, "sequence_no_month", None))
        if a and b:
            return f"Số thứ tự: {a} - {b}"
        if a:
            return f"Số thứ tự: {a}"
        if b:
            return f"Số thứ tự: {b}"
        return ""

    @staticmethod
    def _workstream_label(ws: DbWorkstream) -> str:
        if ws.workstream_type == "PPF_INSTALLATION":
            return "PPF"
        if ws.workstream_type == "WINDOW_FILM_INSTALLATION":
            return "Phim cách nhiệt"
        return _clean_str(ws.workstream_type) or "Luồng"

    @staticmethod
    def _vehicle_model(req: Optional[DbRequest], ws: DbWorkstream) -> str:
        if req:
            m = _clean_str(getattr(req, "model_name", None)) or _clean_str(req.vehicle_model_code)
            if m:
                return m
        return ""

    @staticmethod
    def _work_items_summary(db: Session, ws: DbWorkstream, req: Optional[DbRequest]) -> List[str]:
        lines: List[str] = []
        if ws.workstream_type == "PPF_INSTALLATION":
            try:
                alloc = json.loads(ws.ppf_allocation_json or "{}")
            except json.JSONDecodeError:
                alloc = {}
            for it in alloc.get("items") or []:
                if not it.get("is_selected"):
                    continue
                code = _clean_str(it.get("item_code") or it.get("label"))
                mc = _clean_str(it.get("material_code"))
                parts = [p for p in (code, mc) if p]
                if parts:
                    lines.append(" · ".join(parts))
            if not lines and _clean_str(ws.selected_material_code):
                lines.append(_clean_str(ws.selected_material_code))
        else:
            try:
                alloc = json.loads(ws.wf_allocation_json or "{}")
            except json.JSONDecodeError:
                alloc = {}
            for it in alloc.get("items") or []:
                if not it.get("is_selected"):
                    continue
                ji = _clean_str(it.get("job_item") or it.get("item_code"))
                mc = _clean_str(it.get("material_code"))
                ps = _clean_str(it.get("planned_size") or it.get("size"))
                seg = " — ".join([p for p in (ji, mc, ps) if p])
                if seg:
                    lines.append(seg)
            if not lines and req and (req.norm_application_json or "").strip():
                try:
                    na = json.loads(req.norm_application_json)
                    if isinstance(na, list):
                        for row in na:
                            if not isinstance(row, dict):
                                continue
                            ji = _clean_str(row.get("job_item"))
                            mc = _clean_str(row.get("material_code"))
                            seg = " — ".join([p for p in (ji, mc) if p])
                            if seg:
                                lines.append(seg)
                except json.JSONDecodeError:
                    pass
        return lines

    @staticmethod
    def _enrich_lot_size(db: Session, lot_id: str, material_code: str, fallback_size: str) -> str:
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lot_id).first()
        if lot and lot.original_width_m and lot.original_length_m:
            w = int(round(float(lot.original_width_m) * 100))
            l = int(round(float(lot.original_length_m) * 100))
            return f"{w}x{l}"
        return _clean_str(fallback_size)

    @staticmethod
    def _enrich_offcut_dims(db: Session, oid: str, material_code: str, fw: str, flen: str) -> Tuple[str, str]:
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == oid).first()
        if oc:
            w = int(round(float(oc.width_m or 0) * 100))
            l = int(round(float(oc.length_m or 0) * 100))
            if w > 0 and l > 0:
                return _clean_str(oc.material_code) or material_code, f"{w}x{l}"
        return material_code, f"{fw}x{flen}".replace("x", "x") if fw and flen else ""

    @staticmethod
    def _allocation_lot_offcut_lines(db: Session, ws: DbWorkstream) -> Tuple[List[str], List[str]]:
        lots: List[str] = []
        offcuts: List[str] = []
        if ws.workstream_type == "PPF_INSTALLATION":
            try:
                alloc = json.loads(ws.ppf_allocation_json or "{}")
            except json.JSONDecodeError:
                alloc = {}
        else:
            try:
                alloc = json.loads(ws.wf_allocation_json or "{}")
            except json.JSONDecodeError:
                alloc = {}
        for it in alloc.get("items") or []:
            if not it.get("is_selected"):
                continue
            mc_item = _clean_str(it.get("material_code"))
            ps = _clean_str(it.get("planned_size") or it.get("size"))
            for s in it.get("sources") or []:
                st = (s.get("source_type") or "LOT").upper()
                sid = _clean_str(s.get("source_id"))
                if not sid:
                    continue
                al = float(s.get("allocated_length_m") or 0)
                if al <= 1e-9:
                    continue
                mc = _clean_str(s.get("material_code")) or mc_item
                if st == "LOT":
                    dim = TelegramNotificationService._enrich_lot_size(db, sid, mc, ps)
                    if mc and dim and sid:
                        lots.append(f"{mc} {dim} {sid}")
                elif st == "OFFCUT":
                    fw = str(int(round(float(s.get("width_m") or 0) * 100))) if s.get("width_m") else ""
                    fln = str(int(round(float(s.get("length_m") or 0) * 100))) if s.get("length_m") else ""
                    mcf, dims = TelegramNotificationService._enrich_offcut_dims(db, sid, mc, fw, fln)
                    if mcf and dims and sid:
                        offcuts.append(f"{mcf} {dims} {sid}")
        return lots, offcuts

    @staticmethod
    def send_manager_approved(workstream_id: str) -> None:
        db = SessionLocal()
        try:
            ws, req = TelegramNotificationService._load_ws_req(db, workstream_id)
            if not ws:
                return
            if ws.status not in ("APPROVED", "ASSIGNED_TO_TECHNICIAN"):
                return
            lines: List[str] = [
                "✅ DYC | QUẢN LÝ ĐÃ DUYỆT THI CÔNG",
                "",
            ]
            seq = TelegramNotificationService._sequence_line(req)
            if seq:
                lines.append(seq)
            lines.extend(TelegramNotificationService._dealer_customer_lines(db, req))
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            lines.append(f"Luồng: {TelegramNotificationService._workstream_label(ws)}")
            vm = TelegramNotificationService._vehicle_model(req, ws)
            if vm:
                lines.append(f"Xe: {vm}")
            vin6 = _vin_last6(req.vin_number if req else None)
            if vin6:
                lines.append(f"VIN: {vin6}")
            tn = _clean_str(ws.assigned_technician_name)
            if tn:
                lines.append(f"KTV phụ trách: {tn}")
            if req:
                sc = _clean_str(getattr(req, "sales_consultant", None))
                if sc:
                    lines.append(f"Tư vấn: {sc}")
                dl = _clean_str(getattr(req, "requested_delivery_time", None))
                if dl:
                    lines.append(f"Hạn giao xe: {dl}")
            witems = TelegramNotificationService._work_items_summary(db, ws, req)
            if witems:
                lines.append("")
                lines.append("Hạng mục:")
                lines.extend(witems)
            jc_id = _clean_str(ws.job_card_id)
            link = (
                build_dyc_link(
                    "jobcards",
                    request_id=req.request_id if req else None,
                    job_card_id=jc_id,
                )
                if jc_id
                else build_dyc_link(
                    "workstreams",
                    request_id=req.request_id if req else None,
                    workstream_id=ws.workstream_id,
                )
            )
            lines.append("")
            lines.append("👉 KTV nhấn link để nhận việc:")
            lines.append(link)
            text = "\n".join([ln for ln in lines if ln is not None])
            TelegramNotificationService.send_message_to_group(
                "MANAGER_APPROVED",
                text,
                f"MANAGER_APPROVED:{workstream_id}",
                request_id=ws.request_id,
                workstream_id=ws.workstream_id,
                job_card_id=jc_id or None,
            )
        finally:
            db.close()

    @staticmethod
    def send_tech_allocation_confirmed(workstream_id: str) -> None:
        db = SessionLocal()
        try:
            ws, req = TelegramNotificationService._load_ws_req(db, workstream_id)
            if not ws:
                return
            lots, offcuts = TelegramNotificationService._allocation_lot_offcut_lines(db, ws)
            if not lots and not offcuts:
                token, chat_id, gname = _telegram_creds()
                _log_row(
                    db,
                    event_type="TECH_ALLOCATION_CONFIRMED",
                    dedupe_key=f"TECH_ALLOCATION_CONFIRMED:{workstream_id}",
                    message_text="",
                    send_status="SKIPPED",
                    error_message="NO_ALLOCATION_SOURCE",
                    request_id=ws.request_id,
                    workstream_id=ws.workstream_id,
                    telegram_group_name=gname,
                    telegram_chat_id=chat_id,
                )
                return
            lines = [
                "📦 DYC | KTV ĐÃ XÁC NHẬN PHÂN BỔ",
                "",
            ]
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            lines.append(f"Luồng: {TelegramNotificationService._workstream_label(ws)}")
            tn = _clean_str(ws.assigned_technician_name)
            if tn:
                lines.append(f"KTV: {tn}")
            if lots:
                lines.append("")
                lines.append("Nguồn vật tư đã chốt:")
                lines.append("LOT:")
                lines.extend(lots)
            if offcuts:
                lines.append("")
                lines.append("Mảnh dư:")
                lines.extend(offcuts)
            lines.append("")
            lines.append("Trạng thái: Sẵn sàng thi công")
            lines.append("👉 Mở phân bổ:")
            lines.append(
                build_dyc_link(
                    "workstreams",
                    request_id=req.request_id if req else None,
                    workstream_id=ws.workstream_id,
                )
            )
            text = "\n".join(lines)
            TelegramNotificationService.send_message_to_group(
                "TECH_ALLOCATION_CONFIRMED",
                text,
                f"TECH_ALLOCATION_CONFIRMED:{workstream_id}",
                request_id=ws.request_id,
                workstream_id=ws.workstream_id,
            )
        finally:
            db.close()

    @staticmethod
    def send_job_started(workstream_id: str) -> None:
        db = SessionLocal()
        try:
            ws, req = TelegramNotificationService._load_ws_req(db, workstream_id)
            if not ws:
                return
            st = _clean_str(ws.started_at)
            if not st:
                return
            lines = [
                "🚗 DYC | BẮT ĐẦU THI CÔNG",
                "",
            ]
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            lines.append(f"Luồng: {TelegramNotificationService._workstream_label(ws)}")
            tn = _clean_str(ws.assigned_technician_name)
            if tn:
                lines.append(f"KTV: {tn}")
            lines.append(f"Bắt đầu lúc: {st}")
            if req:
                dl = _clean_str(getattr(req, "requested_delivery_time", None))
                if dl:
                    lines.append(f"Hạn giao xe: {dl}")
            jc_id = _clean_str(ws.job_card_id)
            link = build_dyc_link(
                "jobcards",
                request_id=req.request_id if req else None,
                job_card_id=jc_id,
            ) if jc_id else build_dyc_link(
                "workstreams",
                request_id=req.request_id if req else None,
                workstream_id=ws.workstream_id,
            )
            lines.append("")
            lines.append("👉 Mở Job Card:")
            lines.append(link)
            text = "\n".join(lines)
            TelegramNotificationService.send_message_to_group(
                "JOB_STARTED",
                text,
                f"JOB_STARTED:{workstream_id}",
                request_id=ws.request_id if req else None,
                workstream_id=ws.workstream_id,
                job_card_id=jc_id or None,
            )
        finally:
            db.close()

    @staticmethod
    def send_extra_cut_requested(workstream_id: str, proposal_id: Optional[str] = None) -> None:
        db = SessionLocal()
        try:
            ws, req = TelegramNotificationService._load_ws_req(db, workstream_id)
            if not ws or not ws.extra_cut_requested:
                return
            pid = _clean_str(proposal_id) or "na"
            dedupe = f"EXTRA_CUT_REQUESTED:{workstream_id}:{pid}"[:900]
            lines = [
                "⚠️ DYC | KTV YÊU CẦU CẮT BỔ SUNG",
                "",
            ]
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            lines.append(f"Luồng: {TelegramNotificationService._workstream_label(ws)}")
            tn = _clean_str(ws.assigned_technician_name)
            if tn:
                lines.append(f"KTV: {tn}")
            rs = _clean_str(ws.extra_cut_reason)
            if rs:
                lines.append(f"Lý do: {rs}")
            extras: List[str] = []
            if ws.extra_cut_wf_allocation_json:
                try:
                    ex = json.loads(ws.extra_cut_wf_allocation_json)
                    for it in ex.get("items") or []:
                        ji = _clean_str(it.get("job_item") or it.get("item_code"))
                        mc = _clean_str(it.get("material_code"))
                        seg = " — ".join([p for p in (ji, mc) if p])
                        if seg:
                            extras.append(seg)
                except json.JSONDecodeError:
                    pass
            if extras:
                lines.append("")
                lines.append("Hạng mục cần cắt thêm:")
                lines.extend(extras)
            lines.append("")
            lines.append("👉 Mở yêu cầu cắt bổ sung:")
            lines.append(
                build_dyc_link(
                    "workstreams",
                    request_id=req.request_id if req else None,
                    workstream_id=ws.workstream_id,
                )
            )
            text = "\n".join(lines)
            TelegramNotificationService.send_message_to_group(
                "EXTRA_CUT_REQUESTED",
                text,
                dedupe,
                request_id=ws.request_id,
                workstream_id=ws.workstream_id,
            )
        finally:
            db.close()

    @staticmethod
    def send_job_completed(workstream_id: str) -> None:
        db = SessionLocal()
        try:
            ws, req = TelegramNotificationService._load_ws_req(db, workstream_id)
            if not ws:
                return
            comp = _clean_str(ws.completed_at)
            if not comp:
                return
            if _clean_str(ws.actual_confirmation_status) and ws.actual_confirmation_status != "COMPLETED":
                return
            lines = [
                "✅ DYC | KTV HOÀN TẤT LUỒNG THI CÔNG",
                "",
            ]
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            lines.append(f"Luồng: {TelegramNotificationService._workstream_label(ws)}")
            tn = _clean_str(ws.assigned_technician_name)
            if tn:
                lines.append(f"KTV: {tn}")
            st = _clean_str(ws.started_at)
            if st:
                lines.append(f"Bắt đầu: {st}")
            lines.append(f"Hoàn tất: {comp}")
            jc_id = _clean_str(ws.job_card_id)
            link = build_dyc_link(
                "workstreams",
                request_id=req.request_id if req else None,
                workstream_id=ws.workstream_id,
            )
            lines.append("")
            lines.append("👉 Mở xác nhận thực tế:")
            lines.append(link)
            text = "\n".join(lines)
            TelegramNotificationService.send_message_to_group(
                "JOB_COMPLETED",
                text,
                f"JOB_COMPLETED:{workstream_id}",
                request_id=ws.request_id if req else None,
                workstream_id=ws.workstream_id,
                job_card_id=jc_id or None,
            )
        finally:
            db.close()

    @staticmethod
    def send_request_completion_report(request_id: str) -> None:
        db = SessionLocal()
        try:
            req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
            if not req or req.status != "CLOSED":
                return
            wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
            if not wss:
                return
            if not all(ws.status == "CLOSED" for ws in wss):
                return
            lines = [
                "🏁 DYC | BÁO CÁO HOÀN TẤT ĐƠN THI CÔNG",
                "",
            ]
            rc = TelegramNotificationService._request_code(req)
            if rc:
                lines.append(f"Mã đơn: {rc}")
            vm = TelegramNotificationService._vehicle_model(req, wss[0])
            if vm:
                lines.append(f"Xe: {vm}")
            vin6 = _vin_last6(req.vin_number)
            if vin6:
                lines.append(f"VIN: {vin6}")
            dealer_name = ""
            if _clean_str(req.dealer_id):
                d = db.query(DbDealer).filter(DbDealer.dealer_id == req.dealer_id).first()
                dealer_name = _clean_str(d.dealer_name) if d else ""
            if dealer_name:
                lines.append(f"Dealer: {dealer_name}")
            cust = ""
            if _clean_str(req.customer_id):
                c = db.query(DbCustomer).filter(DbCustomer.customer_id == req.customer_id).first()
                cust = _clean_str(c.customer_name) if c else ""
            if not cust:
                cust = _clean_str(req.customer_name)
            if cust:
                lines.append(f"Khách hàng: {cust}")
            comp_lines: List[str] = []
            has_ppf = any(w.workstream_type == "PPF_INSTALLATION" for w in wss)
            has_wf = any(w.workstream_type == "WINDOW_FILM_INSTALLATION" for w in wss)
            if has_ppf:
                comp_lines.append("PPF: Hoàn tất")
            if has_wf:
                comp_lines.append("Phim cách nhiệt: Hoàn tất")
            if comp_lines:
                lines.append("")
                lines.append("Tổng luồng thi công:")
                lines.extend(comp_lines)
            lines.append("")
            lines.append("👉 Xem chi tiết đơn:")
            lines.append(build_dyc_link("requests", request_id=request_id))
            text = "\n".join([x for x in lines if x])
            TelegramNotificationService.send_message_to_group(
                "REQUEST_COMPLETION_REPORT",
                text,
                f"REQUEST_COMPLETION_REPORT:{request_id}",
                request_id=request_id,
            )
        finally:
            db.close()

    @staticmethod
    def _parse_day(d: date) -> Tuple[str, str]:
        """Return (yyyy-mm-dd, dd/mm/yyyy) in report TZ."""
        try:
            from zoneinfo import ZoneInfo

            z = ZoneInfo(_tz())
            # interpret d as calendar date in TZ
            s = d.isoformat()
            return s, d.strftime("%d/%m/%Y")
        except Exception:
            return d.isoformat(), d.strftime("%d/%m/%Y")

    @staticmethod
    def send_daily_report(report_date: Optional[date] = None) -> None:
        try:
            from zoneinfo import ZoneInfo

            z = ZoneInfo(_tz())
            now = datetime.now(z).date()
        except Exception:
            now = date.today()
        report_date = report_date or now
        yesterday = report_date - timedelta(days=1)
        dkey, dlabel = TelegramNotificationService._parse_day(report_date)
        ykey, _ = TelegramNotificationService._parse_day(yesterday)

        db = SessionLocal()
        try:
            open_mgr = db.query(DbWorkstream).filter(DbWorkstream.status == "PENDING_APPROVAL").count()
            open_tech_alloc = db.query(DbWorkstream).filter(
                DbWorkstream.status == "PENDING_TECH_PREFLIGHT"
            ).count()
            in_prog = db.query(DbWorkstream).filter(DbWorkstream.status == "IN_PROGRESS").count()
            wait_commit = db.query(DbWorkstream).filter(
                DbWorkstream.status == "ACTUAL_CONFIRMATION_REQUIRED"
            ).count()

            today_prefix = report_date.isoformat()
            reqs_today = db.query(DbRequest).filter(
                DbRequest.requested_delivery_time.isnot(None),
                DbRequest.requested_delivery_time.like(f"{today_prefix}%"),
            ).all()
            deadline_total = len(reqs_today)

            y_closed = 0
            y_ppf = 0
            y_wf = 0
            for ws in db.query(DbWorkstream).all():
                ca = _clean_str(ws.completed_at) or _clean_str(ws.closed_at)
                if not ca or not ca.startswith(ykey):
                    continue
                y_closed += 1
                if ws.workstream_type == "PPF_INSTALLATION":
                    y_ppf += 1
                elif ws.workstream_type == "WINDOW_FILM_INSTALLATION":
                    y_wf += 1

            extra_open = db.query(DbWorkstream).filter(DbWorkstream.extra_cut_requested == True).filter(
                DbWorkstream.status.in_(("IN_PROGRESS", "ACTUAL_CONFIRMATION_REQUIRED"))
            ).count()

            sections: Dict[str, List[str]] = {
                "1. Việc đang mở:": [],
                "2. Hạn giao xe hôm nay:": [],
                "3. Hoàn tất hôm qua:": [],
                "4. Cảnh báo:": [],
            }
            if open_mgr:
                sections["1. Việc đang mở:"].append(f"   · Chờ Quản lý duyệt: {open_mgr}")
            if open_tech_alloc:
                sections["1. Việc đang mở:"].append(f"   · Chờ KTV xác nhận phân bổ: {open_tech_alloc}")
            if in_prog:
                sections["1. Việc đang mở:"].append(f"   · Đang thi công: {in_prog}")
            if wait_commit:
                sections["1. Việc đang mở:"].append(f"   · Chờ commit kho: {wait_commit}")
            if deadline_total:
                sections["2. Hạn giao xe hôm nay:"].append(f"   · Tổng: {deadline_total}")
            if y_closed:
                sections["3. Hoàn tất hôm qua:"].append(f"   · Luồng hoàn tất (theo mốc thời gian): {y_closed}")
            if y_ppf:
                sections["3. Hoàn tất hôm qua:"].append(f"   · Luồng PPF: {y_ppf}")
            if y_wf:
                sections["3. Hoàn tất hôm qua:"].append(f"   · Luồng phim cách nhiệt: {y_wf}")
            if extra_open:
                sections["4. Cảnh báo:"].append(f"   · Yêu cầu cắt bổ sung chưa xử lý: {extra_open}")

            body_lines = ["📊 DYC | BÁO CÁO ĐẦU NGÀY - 08:00", "", f"Ngày: {dlabel}", ""]
            body_lines.extend(omit_empty_sections(sections))
            body_lines.append("")
            body_lines.append("👉 Mở dashboard:")
            body_lines.append(build_dyc_link("dashboard"))
            text = "\n".join([ln for ln in body_lines if ln is not None])
            TelegramNotificationService.send_message_to_group(
                "DAILY_REPORT",
                text,
                f"DAILY_REPORT:{dkey}",
            )
        finally:
            db.close()

    @staticmethod
    def send_monthly_report(year: int, month: int) -> None:
        first = date(year, month, 1)
        if month == 12:
            last = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(year, month + 1, 1) - timedelta(days=1)
        prefix = f"{year:04d}-{month:02d}"
        db = SessionLocal()
        try:
            closed_ws: List[DbWorkstream] = []
            for ws in db.query(DbWorkstream).all():
                ca = _clean_str(ws.closed_at) or _clean_str(ws.completed_at)
                if not ca:
                    continue
                if ca[:7] != prefix:
                    continue
                if ws.status != "CLOSED":
                    continue
                closed_ws.append(ws)
            n_ws = len(closed_ws)
            req_ids = {ws.request_id for ws in closed_ws}
            n_req = len(req_ids)
            ppf_n = sum(1 for w in closed_ws if w.workstream_type == "PPF_INSTALLATION")
            wf_n = sum(1 for w in closed_ws if w.workstream_type == "WINDOW_FILM_INSTALLATION")
            on_time = 0
            late = 0
            for ws in closed_ws:
                if ws.is_on_time is True:
                    on_time += 1
                elif ws.is_on_time is False:
                    late += 1
            meters = sum(float(w.actual_length_m or w.planned_deduction_length_m or 0) for w in closed_ws)

            vol: List[str] = []
            if n_req:
                vol.append(f"   · Tổng đơn có luồng đóng trong tháng: {n_req}")
            if n_ws:
                vol.append(f"   · Tổng luồng hoàn tất: {n_ws}")
            if ppf_n:
                vol.append(f"   · PPF: {ppf_n} luồng")
            if wf_n:
                vol.append(f"   · Phim cách nhiệt: {wf_n} luồng")
            sla: List[str] = []
            if on_time:
                sla.append(f"   · Đúng hạn: {on_time}")
            if late:
                sla.append(f"   · Trễ hạn: {late}")
            mat: List[str] = []
            if meters > 1e-9:
                mat.append(f"   · Tổng mét phim (ước lượng theo luồng): {round(meters, 2)} m")
            stats: List[str] = []

            sections = {
                "1. Sản lượng:": vol,
                "2. SLA:": sla,
                "3. Vật tư:": mat,
                "4. Thống kê:": stats,
            }
            title = f"📈 DYC | BÁO CÁO THÁNG {month:02d}/{year}"
            body = [title, "", *omit_empty_sections(sections), "", "👉 Mở báo cáo tháng:", build_dyc_link("monthly", month=prefix)]
            text = "\n".join([ln for ln in body if ln])
            TelegramNotificationService.send_message_to_group(
                "MONTHLY_REPORT",
                text,
                f"MONTHLY_REPORT:{prefix}",
            )
        finally:
            db.close()


def notify_safe(fn, *args, **kwargs) -> None:
    """Gọi hàm notify — không raise ra ngoài API nghiệp vụ."""
    try:
        fn(*args, **kwargs)
    except Exception as e:
        LOG.warning("Telegram notify_safe: %s", e)


def notify_manager_approved(ws_id: str) -> None:
    notify_safe(TelegramNotificationService.send_manager_approved, ws_id)


def notify_tech_allocation_confirmed(ws_id: str) -> None:
    notify_safe(TelegramNotificationService.send_tech_allocation_confirmed, ws_id)


def notify_job_started(ws_id: str) -> None:
    notify_safe(TelegramNotificationService.send_job_started, ws_id)


def notify_extra_cut(ws_id: str, proposal_id: Optional[str] = None) -> None:
    notify_safe(TelegramNotificationService.send_extra_cut_requested, ws_id, proposal_id)


def notify_job_completed(ws_id: str) -> None:
    notify_safe(TelegramNotificationService.send_job_completed, ws_id)


def notify_request_completion(request_id: str) -> None:
    notify_safe(TelegramNotificationService.send_request_completion_report, request_id)


def maybe_notify_request_completion(db: Session, request_id: str) -> None:
    try:
        db.expire_all()
    except Exception:
        pass
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req:
        return
    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
    all_ws_closed = not wss or all(ws.status == "CLOSED" for ws in wss)
    if not all_ws_closed and req.status != "CLOSED":
        return
    notify_request_completion(request_id)
