# -*- coding: utf-8 -*-
"""
Báo cáo ngày (WF7 / dashboard): dữ liệu snapshot tại thời điểm gọi API, múi giờ VN.
Không trừ kho, không seed — chỉ đọc DbRequest / DbWorkstream / DbJobCard.
"""
from __future__ import annotations

import html
import re
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from database import DbJobCard, DbRequest, DbWorkstream

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

VN_TZ = "Asia/Ho_Chi_Minh"

BAD_DISPLAY = frozenset(
    {"", "none", "null", "n/a", "unknown", "undefined", "—", "-"}
)


def _vn_zone():
    if ZoneInfo:
        try:
            return ZoneInfo(VN_TZ)
        except Exception:
            pass
    return None


def today_vn() -> date:
    z = _vn_zone()
    if z:
        return datetime.now(z).date()
    return date.today()


def generated_at_iso() -> str:
    z = _vn_zone()
    if z:
        return datetime.now(z).replace(microsecond=0).isoformat()
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _clean_display(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if not s or s.lower() in BAD_DISPLAY:
        return ""
    return s


def vin_last6(vin: Optional[str]) -> str:
    s = _clean_display(vin)
    if not s:
        return ""
    tail = re.sub(r"\s+", "", s)[-6:]
    return tail if len(tail) >= 4 else tail


def parse_date_param(date_str: str) -> date:
    s = (date_str or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        raise ValueError("date phải là YYYY-MM-DD")
    y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
    return date(y, m, d)


def _parse_ts_to_vn_date(s: Optional[str]) -> Optional[date]:
    if not s or not str(s).strip():
        return None
    raw = str(s).strip().replace("Z", "+00:00")
    z = _vn_zone()
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            from datetime import timezone as _tz

            dt = dt.replace(tzinfo=_tz.utc)
        if z:
            return dt.astimezone(z).date()
        return dt.date()
    except Exception:
        pass
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        try:
            return date.fromisoformat(raw[:10])
        except Exception:
            pass
    return None


def _parse_iso_to_vn_dt(s: Optional[str]) -> Optional[datetime]:
    """Chuỗi ISO / date-only → datetime theo múi VN (nếu có)."""
    if not s or not str(s).strip():
        return None
    raw = str(s).strip().replace("Z", "+00:00")
    z = _vn_zone()
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            if z:
                dt = dt.replace(tzinfo=z)
            else:
                from datetime import timezone as _tz

                dt = dt.replace(tzinfo=_tz.utc)
        elif z:
            dt = dt.astimezone(z)
        return dt
    except Exception:
        pass
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        try:
            d = date.fromisoformat(raw[:10])
            if z:
                return datetime.combine(d, time.min, tzinfo=z)
            return datetime.combine(d, time.min)
        except Exception:
            pass
    return None


def _fmt_hhmm_dmy(dt: datetime) -> str:
    return dt.strftime("%H:%M %d/%m/%Y")


def _due_bucket_sort_key(bucket: str) -> int:
    b = bucket or ""
    if "trễ" in b.lower() or "Trễ" in b:
        return 0
    if "Đúng" in b or "trong ngày" in b:
        return 1
    if "đóng" in b.lower():
        return 2
    return 3


def _execution_window_text(req: Optional[DbRequest], wss: List[DbWorkstream]) -> str:
    z = _vn_zone()
    points: List[datetime] = []
    for w in wss:
        for fld in (w.started_at, w.completed_at, w.closed_at):
            dt = _parse_iso_to_vn_dt(fld)
            if dt:
                points.append(dt)
    ddl = _parse_delivery_datetime(req.requested_delivery_time) if req else None
    if ddl:
        if ddl.tzinfo is None and z:
            ddl = ddl.replace(tzinfo=z)
        if z and ddl.tzinfo:
            points.append(ddl.astimezone(z))
        else:
            points.append(ddl)
    if len(points) >= 2:
        a, b = min(points), max(points)
        if a == b:
            return _fmt_hhmm_dmy(a)
        return f"{_fmt_hhmm_dmy(a)} — {_fmt_hhmm_dmy(b)}"
    if len(points) == 1:
        return _fmt_hhmm_dmy(points[0])
    if req and _clean_display(req.requested_delivery_time):
        return f"Hạn giao: {_clean_display(req.requested_delivery_time)}"
    return "—"


def _manager_notes_for_request(req: Optional[DbRequest], wss: List[DbWorkstream]) -> str:
    parts: List[str] = []
    if req and req.status == "EXCEPTION_HOLD":
        parts.append("Đơn: EXCEPTION_HOLD")
    for w in sorted(wss, key=lambda x: (x.workstream_type or "", x.workstream_id or "")):
        label = _workstream_label(w)
        if _ws_open(w):
            parts.append(f"{label}: {_open_category(w)}")
        else:
            st = _clean_display(w.status)
            if st:
                parts.append(f"{label}: {st}")
    return " · ".join(parts) if parts else "—"


def _request_hoan_thanh(req: Optional[DbRequest], wss: List[DbWorkstream]) -> bool:
    if not req:
        return False
    if req.status == "CLOSED":
        return True
    active = [w for w in wss if (w.status or "").upper() != "CANCELLED"]
    if not active:
        return False
    return all((w.status or "").upper() == "CLOSED" for w in active)


def _build_manager_daily_rows(
    *,
    due_today_items: List[Dict[str, Any]],
    open_ws: List[DbWorkstream],
    workstreams: List[DbWorkstream],
    req_by_id: Dict[str, DbRequest],
) -> List[Dict[str, Any]]:
    """
    Một dòng / đơn xe — cột gần với mẫu quản lý (STT, khung thời gian, TVBH, SK, dòng xe, PPF, PCN, hoàn tất, ghi chú).
    Tập hợp: đơn có hạn giao trong ngày D + đơn còn luồng đang mở.
    """
    mgr_rids: Set[str] = set()
    due_by_rid: Dict[str, Dict[str, Any]] = {}
    for x in due_today_items:
        rid = str(x.get("request_id") or "").strip()
        if rid:
            mgr_rids.add(rid)
            due_by_rid[rid] = x
    for w in open_ws:
        rid = str(w.request_id or "").strip()
        if rid:
            mgr_rids.add(rid)

    ws_by_req: Dict[str, List[DbWorkstream]] = {}
    for w in workstreams:
        rid = str(w.request_id or "").strip()
        if not rid:
            continue
        ws_by_req.setdefault(rid, []).append(w)

    def _sort_key(rid: str) -> Tuple[int, int, str]:
        due = rid in due_by_rid
        bucket = (due_by_rid.get(rid) or {}).get("bucket") or ""
        r = req_by_id.get(rid)
        code = _request_code(r) or rid
        return (0 if due else 1, _due_bucket_sort_key(str(bucket)), code)

    rows_out: List[Dict[str, Any]] = []
    for rid in sorted(mgr_rids, key=_sort_key):
        r = req_by_id.get(rid)
        wss = ws_by_req.get(rid, [])
        has_ppf = any(
            w.workstream_type == "PPF_INSTALLATION" and (w.status or "").upper() != "CANCELLED" for w in wss
        )
        has_pcn = any(
            w.workstream_type == "WINDOW_FILM_INSTALLATION"
            and (w.status or "").upper() != "CANCELLED"
            for w in wss
        )
        due_info = due_by_rid.get(rid) or {}
        detail_link = f"/?tab=requests&request_id={rid}" if rid else ""
        rows_out.append(
            {
                "request_id": rid,
                "request_code": _request_code(r),
                "stt_thang": _clean_display(getattr(r, "sequence_no_month", None) if r else None)
                or _clean_display(getattr(r, "sequence_no", None) if r else None),
                "sales_consultant": _clean_display(getattr(r, "sales_consultant", None) if r else None) or "—",
                "vin_last6": vin_last6(r.vin_number if r else None) or "—",
                "vehicle_model": _vehicle_line(r) or "—",
                "ppf": bool(has_ppf),
                "pcn": bool(has_pcn),
                "hoan_thanh": _request_hoan_thanh(r, wss),
                "ngay_thuc_hien": _execution_window_text(r, wss),
                "ghi_chu": _manager_notes_for_request(r, wss),
                "due_in_day": rid in due_by_rid,
                "due_bucket": str(due_info.get("bucket") or ""),
                "detail_link": detail_link,
            }
        )
    return rows_out


def _parse_delivery_datetime(s: Optional[str]) -> Optional[datetime]:
    """Parse requested_delivery_time / job field — có thể là ISO hoặc date-only."""
    if not s or not str(s).strip():
        return None
    raw = str(s).strip().replace("Z", "+00:00")
    z = _vn_zone()
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None and z:
            dt = dt.replace(tzinfo=z)
        elif dt.tzinfo is None:
            from datetime import timezone as _tz

            dt = dt.replace(tzinfo=_tz.utc)
            if z:
                dt = dt.astimezone(z)
        return dt
    except Exception:
        pass
    if len(raw) >= 10 and raw[4] == "-" and raw[7] == "-":
        try:
            d = date.fromisoformat(raw[:10])
            if z:
                return datetime.combine(d, time(23, 59, 59), tzinfo=z)
            return datetime.combine(d, time(23, 59, 59))
        except Exception:
            pass
    return None


def _delivery_calendar_date(s: Optional[str]) -> Optional[date]:
    dt = _parse_delivery_datetime(s)
    if not dt:
        return None
    z = _vn_zone()
    if dt.tzinfo and z:
        return dt.astimezone(z).date()
    return dt.date()


def _ws_terminal(ws: DbWorkstream) -> bool:
    return ws.status in ("CLOSED", "CANCELLED")


def _ws_open(ws: DbWorkstream) -> bool:
    return not _ws_terminal(ws)


def _workstream_label(ws: DbWorkstream) -> str:
    if ws.workstream_type == "PPF_INSTALLATION":
        return "PPF"
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION":
        return "Phim cách nhiệt"
    return _clean_display(ws.workstream_type) or "Luồng"


def _sla_text(ws: DbWorkstream, jc: Optional[DbJobCard]) -> str:
    src = jc or ws
    if getattr(src, "is_on_time", None) is True:
        return "Đúng hạn"
    if getattr(src, "is_on_time", None) is False:
        dm = int(getattr(src, "delay_minutes", None) or 0)
        if dm > 0:
            return f"Trễ {dm} phút"
        return "Trễ hạn"
    dm = int(getattr(ws, "delay_minutes", None) or 0)
    if dm > 0:
        return f"Trễ {dm} phút"
    return "Đang theo dõi"


def _dealer_customer(req: Optional[DbRequest]) -> str:
    if not req:
        return ""
    dn = _clean_display(req.dealer_name)
    cn = _clean_display(req.customer_name)
    if dn and cn:
        return f"Đại lý: {dn} — Khách: {cn}"
    if dn:
        return f"Đại lý: {dn}"
    if cn:
        return f"Khách hàng: {cn}"
    return ""


def _request_code(req: Optional[DbRequest]) -> str:
    if not req:
        return ""
    return _clean_display(req.request_no) or _clean_display(req.request_id)


def _vehicle_line(req: Optional[DbRequest]) -> str:
    if not req:
        return ""
    return _clean_display(req.model_name) or _clean_display(req.vehicle_model_code)


def _open_category(ws: DbWorkstream) -> str:
    st = ws.status or ""
    if st == "PENDING_APPROVAL":
        return "Chờ Quản lý duyệt"
    if st == "PENDING_TECH_PREFLIGHT":
        return "Chờ KTV xác nhận phân bổ"
    if st == "APPROVED":
        return "Đã giao KTV / chờ bắt đầu"
    if st == "IN_PROGRESS":
        return "Đang thi công"
    if st == "ACTUAL_CONFIRMATION_REQUIRED":
        ac = (ws.actual_confirmation_status or "").upper()
        if ac != "COMPLETED":
            return "Chờ nhập xác nhận thực tế"
        return "Chờ commit kho (đã nhập actual)"
    if st == "COMPLETED":
        if not ws.inventory_committed:
            return "Chờ commit kho"
    return f"Mở — {st}" if st else "Mở"


def build_daily_report(db: Session, report_date: date) -> Dict[str, Any]:
    prev = report_date - timedelta(days=1)
    z = _vn_zone()
    now_cutoff = datetime.now(z) if z else datetime.utcnow()

    requests: List[DbRequest] = db.query(DbRequest).all()
    workstreams: List[DbWorkstream] = db.query(DbWorkstream).all()
    job_cards: List[DbJobCard] = db.query(DbJobCard).all()
    jc_by_id = {j.job_card_id: j for j in job_cards if j.job_card_id}
    req_by_id = {r.request_id: r for r in requests if r.request_id}

    open_ws = [w for w in workstreams if _ws_open(w)]
    pending_approval = sum(1 for w in open_ws if w.status == "PENDING_APPROVAL")
    pending_tech = sum(1 for w in open_ws if w.status == "PENDING_TECH_PREFLIGHT")
    in_progress = sum(1 for w in open_ws if w.status == "IN_PROGRESS")
    pending_actual = sum(
        1
        for w in open_ws
        if w.status == "ACTUAL_CONFIRMATION_REQUIRED"
        and (w.actual_confirmation_status or "").upper() != "COMPLETED"
    )
    wait_commit = sum(
        1
        for w in open_ws
        if (
            w.status == "ACTUAL_CONFIRMATION_REQUIRED"
            and (w.actual_confirmation_status or "").upper() == "COMPLETED"
        )
        or (w.status == "COMPLETED" and not w.inventory_committed)
    )

    extra_cut_open = sum(
        1
        for w in open_ws
        if getattr(w, "extra_cut_requested", False)
    )

    # Hạn giao xe trong ngày D (theo request; fallback job_card)
    due_today_items: List[Dict[str, Any]] = []
    seen_due_req: Set[str] = set()
    for r in requests:
        dreq = _delivery_calendar_date(r.requested_delivery_time)
        if dreq != report_date:
            continue
        seen_due_req.add(r.request_id)
        if r.status in ("CLOSED", "CANCELLED"):
            bucket = "Đã đóng đơn"
        else:
            ddl = _parse_delivery_datetime(r.requested_delivery_time)
            if ddl and ddl < now_cutoff:
                bucket = "Đã trễ"
            else:
                bucket = "Đúng tiến độ / trong ngày"
        due_today_items.append(
            {
                "request_id": r.request_id,
                "request_code": _request_code(r),
                "vehicle": _vehicle_line(r),
                "vin_last6": vin_last6(r.vin_number),
                "dealer_customer": _dealer_customer(r),
                "request_status": _clean_display(r.status),
                "bucket": bucket,
            }
        )

    for jc in job_cards:
        rid = jc.request_id or ""
        if not rid or rid in seen_due_req:
            continue
        dreq = _delivery_calendar_date(jc.requested_delivery_time)
        if dreq != report_date:
            continue
        r = req_by_id.get(rid)
        if not r:
            continue
        seen_due_req.add(rid)
        if r.status in ("CLOSED", "CANCELLED"):
            bucket = "Đã đóng đơn"
        else:
            ddl = _parse_delivery_datetime(jc.requested_delivery_time or r.requested_delivery_time)
            if ddl and ddl < now_cutoff:
                bucket = "Đã trễ"
            else:
                bucket = "Đúng tiến độ / trong ngày"
        due_today_items.append(
            {
                "request_id": r.request_id,
                "request_code": _request_code(r),
                "vehicle": _vehicle_line(r),
                "vin_last6": vin_last6(r.vin_number),
                "dealer_customer": _dealer_customer(r),
                "request_status": _clean_display(r.status),
                "bucket": bucket,
                "source": "job_card",
            }
        )

    overdue_risk = 0
    for w in open_ws:
        r = req_by_id.get(w.request_id or "")
        if not r:
            continue
        ddl = _parse_delivery_datetime(r.requested_delivery_time)
        if ddl and ddl < now_cutoff:
            overdue_risk += 1

    # Hoàn tất hôm qua (D-1): mốc completed_at hoặc closed_at (theo ngày lịch VN) = D-1
    completed_yesterday_ws: List[DbWorkstream] = []
    for w in workstreams:
        d_close = _parse_ts_to_vn_date(w.closed_at)
        d_comp = _parse_ts_to_vn_date(w.completed_at)
        if d_close == prev or d_comp == prev:
            completed_yesterday_ws.append(w)

    y_ppf = sum(
        1
        for w in completed_yesterday_ws
        if w.workstream_type == "PPF_INSTALLATION" and _ws_terminal(w)
    )
    y_wf = sum(
        1
        for w in completed_yesterday_ws
        if w.workstream_type == "WINDOW_FILM_INSTALLATION" and _ws_terminal(w)
    )

    completed_yesterday_requests = 0
    for r in requests:
        rid = r.request_id
        wss = [x for x in workstreams if x.request_id == rid]
        if not wss or not all(_ws_terminal(x) for x in wss):
            continue
        dates: List[date] = []
        for x in wss:
            for fld in (x.closed_at, x.completed_at):
                dd = _parse_ts_to_vn_date(fld)
                if dd:
                    dates.append(dd)
        if dates and max(dates) == prev:
            completed_yesterday_requests += 1

    warnings: List[Dict[str, Any]] = []
    warn_keys = set()

    def _add_warn(wtype: str, msg: str, rid: Optional[str], wsid: Optional[str]) -> None:
        key = (wtype, rid or "", wsid or "", msg[:120])
        if key in warn_keys:
            return
        warn_keys.add(key)
        warnings.append(
            {
                "type": wtype,
                "message": msg,
                "request_id": rid,
                "workstream_id": wsid,
            }
        )

    for w in open_ws:
        if w.extra_cut_requested:
            _add_warn(
                "EXTRA_CUT_OPEN",
                f"Yêu cầu cắt bổ sung chưa xử lý xong — {_workstream_label(w)}",
                w.request_id,
                w.workstream_id,
            )

    for r in requests:
        if r.status == "EXCEPTION_HOLD":
            _add_warn(
                "EXCEPTION_HOLD",
                "Đơn ở trạng thái EXCEPTION_HOLD — cần xử lý ngoại lệ",
                r.request_id,
                None,
            )

    for w in workstreams:
        if w.status in ("CLOSED", "CANCELLED"):
            continue
        if w.inventory_committed is False and (w.completed_at or (w.actual_confirmation_status or "").upper() == "COMPLETED"):
            _add_warn(
                "INVENTORY_NOT_COMMITTED",
                "Luồng có dấu hiệu hoàn tất nhưng inventory_committed=false",
                w.request_id,
                w.workstream_id,
            )

    for w in open_ws:
        r = req_by_id.get(w.request_id or "")
        if not r:
            continue
        ddl = _parse_delivery_datetime(r.requested_delivery_time)
        if ddl and ddl < now_cutoff:
            if w.status in ("PENDING_APPROVAL", "PENDING_TECH_PREFLIGHT", "APPROVED"):
                _add_warn(
                    "OVERDUE_NOT_STARTED",
                    "Đã quá hạn giao xe nhưng luồng chưa bắt đầu thi công",
                    w.request_id,
                    w.workstream_id,
                )
            elif w.status == "IN_PROGRESS":
                _add_warn(
                    "OVERDUE_IN_PROGRESS",
                    "Đã quá hạn giao xe — luồng đang thi công",
                    w.request_id,
                    w.workstream_id,
                )

    for w in workstreams:
        if w.status not in ("IN_PROGRESS", "ACTUAL_CONFIRMATION_REQUIRED", "CLOSED"):
            continue
        jc = jc_by_id.get(w.job_card_id or "") if w.job_card_id else None
        if jc and jc.actual_confirmation_status == "PENDING" and jc.status in ("COMPLETED_BY_TECHNICIAN", "COMPLETED"):
            _add_warn(
                "ACTUAL_PENDING_INCONSISTENT",
                "Job Card hoàn tất nhưng actual_confirmation_status vẫn PENDING",
                w.request_id,
                w.workstream_id,
            )

    open_work = []
    for w in sorted(open_ws, key=lambda x: (x.request_id or "", x.workstream_id or "")):
        r = req_by_id.get(w.request_id or "")
        jc = jc_by_id.get(w.job_card_id or "") if w.job_card_id else None
        open_work.append(
            {
                "request_id": w.request_id,
                "workstream_id": w.workstream_id,
                "category": _open_category(w),
                "workstream_label": _workstream_label(w),
                "status": _clean_display(w.status),
                "request_code": _request_code(r),
            }
        )

    completed_yesterday_list = []
    for w in completed_yesterday_ws:
        r = req_by_id.get(w.request_id or "")
        completed_yesterday_list.append(
            {
                "request_id": w.request_id,
                "workstream_id": w.workstream_id,
                "workstream_type": w.workstream_type,
                "label": _workstream_label(w),
                "request_code": _request_code(r),
                "closed_at": _clean_display(w.closed_at),
                "completed_at": _clean_display(w.completed_at),
            }
        )

    detail_rows: List[Dict[str, Any]] = []
    for w in sorted(workstreams, key=lambda x: (x.request_id or "", x.workstream_id or "")):
        r = req_by_id.get(w.request_id or "")
        jc = jc_by_id.get(w.job_card_id or "") if w.job_card_id else None
        warn_tags = []
        if w.extra_cut_requested and _ws_open(w):
            warn_tags.append("Cắt bổ sung")
        ddl = _parse_delivery_datetime(r.requested_delivery_time) if r else None
        if ddl and ddl < now_cutoff and _ws_open(w):
            warn_tags.append("Quá hạn giao")
        if r and r.status == "EXCEPTION_HOLD":
            warn_tags.append("EXCEPTION_HOLD")
        if (
            not _ws_terminal(w)
            and w.inventory_committed is False
            and (w.completed_at or (w.actual_confirmation_status or "").upper() == "COMPLETED")
        ):
            warn_tags.append("Chờ commit kho")

        detail_link = f"/?tab=workstreams&workstream_id={w.workstream_id}"
        if r and r.request_id:
            detail_link = f"/?tab=requests&request_id={r.request_id}"

        mat = _clean_display(w.selected_material_code)
        detail_rows.append(
            {
                "request_code": _request_code(r),
                "workstream_id": w.workstream_id,
                "workstream_type": _workstream_label(w),
                "vehicle": _vehicle_line(r),
                "vin_last6": vin_last6(r.vin_number if r else None),
                "dealer_customer": _dealer_customer(r),
                "technician_team": _clean_display(w.technician_team) or _clean_display(w.assigned_technician_name),
                "status": _clean_display(w.status),
                "requested_delivery_time": _clean_display(r.requested_delivery_time if r else None),
                "started_at": _clean_display(w.started_at),
                "completed_at": _clean_display(w.completed_at),
                "sla": _sla_text(w, jc),
                "warnings": ", ".join(warn_tags) if warn_tags else "",
                "detail_link": detail_link,
                "material_code": mat,
            }
        )

    kpis = {
        "open_total": len(open_ws),
        "due_today_total": len(due_today_items),
        "completed_yesterday_requests": completed_yesterday_requests,
        "completed_yesterday_ppf": y_ppf,
        "completed_yesterday_wf": y_wf,
        "in_progress": in_progress,
        "pending_tech_allocation": pending_tech,
        "waiting_inventory_commit": wait_commit,
        "extra_cut_open": extra_cut_open,
        "overdue_or_risk": overdue_risk,
        "pending_approval": pending_approval,
        "pending_actual_confirmation": pending_actual,
    }

    manager_daily_rows = _build_manager_daily_rows(
        due_today_items=due_today_items,
        open_ws=open_ws,
        workstreams=workstreams,
        req_by_id=req_by_id,
    )

    return {
        "report_date": report_date.isoformat(),
        "previous_date": prev.isoformat(),
        "generated_at": generated_at_iso(),
        "kpis": kpis,
        "open_work": open_work,
        "due_today": due_today_items,
        "completed_yesterday": completed_yesterday_list,
        "warnings": warnings,
        "detail_rows": detail_rows,
        "manager_daily_rows": manager_daily_rows,
    }


def _esc(s: str) -> str:
    return html.escape(s or "", quote=True)


def build_daily_report_html(payload: Dict[str, Any]) -> str:
    iso_d = str(payload.get("report_date") or "")
    rd = _esc(iso_d)
    gen = _esc(str(payload.get("generated_at") or ""))
    title = f"DYC_Bao_Cao_Ngay_{iso_d or 'report'}"
    try:
        d_obj = date.fromisoformat(iso_d) if iso_d else None
        d_label = d_obj.strftime("%d/%m/%Y") if d_obj else iso_d
    except Exception:
        d_label = iso_d
    d_label_e = _esc(d_label)

    def kpi_block() -> str:
        k = payload.get("kpis") or {}
        items = [
            ("Việc đang mở", k.get("open_total")),
            ("Hạn giao xe (ngày chọn)", k.get("due_today_total")),
            ("Hoàn tất đơn (hôm qua)", k.get("completed_yesterday_requests")),
            ("Luồng PPF hoàn tất (hôm qua)", k.get("completed_yesterday_ppf")),
            ("Luồng CN hoàn tất (hôm qua)", k.get("completed_yesterday_wf")),
            ("Đang thi công", k.get("in_progress")),
            ("Chờ KTV phân bổ", k.get("pending_tech_allocation")),
            ("Chờ commit kho", k.get("waiting_inventory_commit")),
            ("Cắt bổ sung mở", k.get("extra_cut_open")),
            ("Quá hạn (luồng mở)", k.get("overdue_or_risk")),
        ]
        parts = ['<div class="kpi-grid">']
        for label, val in items:
            if val is None:
                continue
            parts.append(
                f'<div class="kpi"><div class="kpi-v">{_esc(str(val))}</div><div class="kpi-l">{_esc(label)}</div></div>'
            )
        parts.append("</div>")
        return "\n".join(parts)

    def section(title_s: str, body_html: str, empty_msg: str = "Không có dữ liệu phát sinh.") -> str:
        t = body_html.strip()
        if not t or t == "<ul></ul>":
            inner = f'<p class="muted">{_esc(empty_msg)}</p>'
        else:
            inner = body_html
        return f'<section><h2>{_esc(title_s)}</h2>{inner}</section>'

    def ul_from_dicts(items: List[Dict], fmt) -> str:
        if not items:
            return ""
        lis = []
        for it in items:
            line = fmt(it)
            if line:
                lis.append(f"<li>{_esc(line)}</li>")
        return "<ul>" + "".join(lis) + "</ul>" if lis else ""

    ow = payload.get("open_work") or []
    ow_html = ul_from_dicts(
        ow,
        lambda x: f"{x.get('request_code') or x.get('request_id') or ''} — {x.get('workstream_label', '')} — {x.get('category', '')}",
    )

    dt = payload.get("due_today") or []
    dt_html = ul_from_dicts(
        dt,
        lambda x: f"{x.get('request_code') or ''} ({x.get('bucket', '')}) — {x.get('vehicle', '')}",
    )

    cy = payload.get("completed_yesterday") or []
    cy_html = ul_from_dicts(
        cy,
        lambda x: f"{x.get('request_code') or ''} — {x.get('label', '')} — WS {x.get('workstream_id', '')}",
    )

    warn = payload.get("warnings") or []
    w_html = ul_from_dicts(warn, lambda x: str(x.get("message") or ""))

    rows = payload.get("detail_rows") or []
    ths = [
        "Mã đơn",
        "Mã luồng",
        "Loại",
        "Xe",
        "VIN",
        "Dealer/KH",
        "KTV/Đội",
        "Trạng thái",
        "Hạn giao",
        "Bắt đầu",
        "Hoàn tất",
        "SLA",
        "Cảnh báo",
        "Link",
    ]
    thead = "<tr>" + "".join(f"<th>{_esc(h)}</th>" for h in ths) + "</tr>"
    trs = []
    for row in rows:
        trs.append(
            "<tr>"
            + "".join(
                f"<td>{_esc(str(row.get(k) or ''))}</td>"
                for k in (
                    "request_code",
                    "workstream_id",
                    "workstream_type",
                    "vehicle",
                    "vin_last6",
                    "dealer_customer",
                    "technician_team",
                    "status",
                    "requested_delivery_time",
                    "started_at",
                    "completed_at",
                    "sla",
                    "warnings",
                    "detail_link",
                )
            )
            + "</tr>"
        )
    table_html = f'<table><thead>{thead}</thead><tbody>{"".join(trs)}</tbody></table>'

    mgr_rows = payload.get("manager_daily_rows") or []
    mgr_ths = [
        "STT",
        "STT tháng",
        "Ngày thực hiện / hạn",
        "Mã đơn",
        "Tư vấn bán hàng",
        "Số khung (6)",
        "Dòng xe",
        "PPF",
        "PCN",
        "Hoàn thành",
        "Nhóm hạn (ngày D)",
        "Ghi chú (luồng)",
        "Link",
    ]
    mgr_thead = "<tr>" + "".join(f"<th>{_esc(h)}</th>" for h in mgr_ths) + "</tr>"
    mgr_trs = []
    for i, row in enumerate(mgr_rows, 1):
        mgr_trs.append(
            "<tr>"
            f"<td>{i}</td>"
            f"<td>{_esc(str(row.get('stt_thang') or ''))}</td>"
            f"<td>{_esc(str(row.get('ngay_thuc_hien') or ''))}</td>"
            f"<td>{_esc(str(row.get('request_code') or ''))}</td>"
            f"<td>{_esc(str(row.get('sales_consultant') or ''))}</td>"
            f"<td>{_esc(str(row.get('vin_last6') or ''))}</td>"
            f"<td>{_esc(str(row.get('vehicle_model') or ''))}</td>"
            f"<td style='text-align:center'>{'x' if row.get('ppf') else ''}</td>"
            f"<td style='text-align:center'>{'x' if row.get('pcn') else ''}</td>"
            f"<td style='text-align:center'>{'x' if row.get('hoan_thanh') else ''}</td>"
            f"<td>{_esc(str(row.get('due_bucket') or ''))}</td>"
            f"<td>{_esc(str(row.get('ghi_chu') or ''))}</td>"
            f"<td>{_esc(str(row.get('detail_link') or ''))}</td>"
            "</tr>"
        )
    mgr_table_html = f'<table><thead>{mgr_thead}</thead><tbody>{"".join(mgr_trs)}</tbody></table>' if mgr_trs else ""

    css = """
    body{font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;background:#f7f7f7;color:#111111;}
    h1{font-size:22px;margin:0 0 8px;font-weight:800;color:#111;}
    .meta{color:#555555;font-size:13px;margin-bottom:20px;}
    .brand{font-weight:800;color:#D71920;letter-spacing:0.12em;font-size:14px;}
    section{margin-bottom:28px;}
    h2{font-size:15px;border-bottom:2px solid #D71920;padding-bottom:6px;margin-bottom:12px;color:#111;font-weight:700;}
    ul{margin:0;padding-left:20px;}
    li{margin-bottom:6px;font-size:13px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:12px 0;}
    .kpi{border:1px solid #e5e5e5;border-radius:16px;padding:14px;background:#fff;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.04);}
    .kpi-v{font-size:22px;font-weight:800;color:#111;}
    .kpi-l{font-size:11px;color:#555;margin-top:4px;}
    table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;}
    th,td{border:1px solid #e5e5e5;padding:8px;text-align:left;vertical-align:top;}
    th{background:#f0f0f0;font-weight:700;color:#333;}
    .muted{color:#666;}
    footer{margin-top:32px;font-size:11px;color:#888;}
    @media print{body{background:#fff;}section{break-inside:avoid;}}
    """

    body = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>{_esc(title)}</title>
<style>{css}</style>
</head>
<body>
  <div class="brand">DYC</div>
  <h1>DYC | Báo cáo ngày {d_label_e}</h1>
  <p class="meta">Thời điểm xuất: {_esc(gen)} — Ngày báo cáo (D): {rd} — D-1: {_esc(str(payload.get('previous_date') or ''))}</p>
  <h2>Tóm tắt KPI</h2>
  {kpi_block()}
  {section("1. Việc đang mở", f"<div>{ow_html}</div>")}
  {section("2. Hạn giao xe trong ngày đã chọn", f"<div>{dt_html}</div>")}
  {section("3. Hoàn tất hôm qua (D-1)", f"<div>{cy_html}</div>")}
  {section("4. Cảnh báo", f"<div>{w_html}</div>")}
  {section("5. Theo dõi theo xe (quản lý)", f"<div>{mgr_table_html}</div>" if mgr_table_html else "", "Không có đơn trong tầm nhìn (hạn giao ngày D + đơn còn luồng mở).")}
  {section("6. Bảng chi tiết theo luồng", f"<div>{table_html}</div>", "Không có luồng nào.")}
  <footer>Generated by DYC Warehouse System</footer>
</body>
</html>"""
    return body
