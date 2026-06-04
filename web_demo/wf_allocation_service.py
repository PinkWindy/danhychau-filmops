# -*- coding: utf-8 -*-
"""Window Film — phân bổ nhiều nguồn LOT/OFFCUT theo hạng mục kính (trước duyệt, không trừ kho)."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import DbLotInventory, DbOffcutInventory, DbRequest, DbWorkstream

WINDOW_FILM_JOB_TEMPLATE: List[Dict[str, str]] = [
    {"job_item": "WINDSHIELD", "item_name": "Kính lái"},
    {"job_item": "REAR_WINDOW", "item_name": "Kính hậu"},
    {"job_item": "FRONT_SIDE", "item_name": "Sườn trước"},
    {"job_item": "REAR_SIDE_TRIANGLE", "item_name": "Sườn sau + tam giác"},
    {"job_item": "TRIANGLE", "item_name": "Tam giác"},
    {"job_item": "REAR_SIDE", "item_name": "Sườn sau"},
    {"job_item": "SUNROOF", "item_name": "Kính trời"},
]


def _err(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": code, "message": message})


def _service_wf_jobs(req: Optional[DbRequest]) -> set:
    if not req or not req.service_selection_json:
        return set()
    try:
        svc = json.loads(req.service_selection_json)
    except json.JSONDecodeError:
        return set()
    return {str(x).strip() for x in (svc.get("window_film_items") or []) if str(x).strip()}


def _job_items_from_request(req: Optional[DbRequest]) -> set:
    if not req or not req.job_items:
        return set()
    return {x.strip() for x in (req.job_items or "").split(";") if x.strip()}


def build_default_wf_allocation(db: Session, ws: DbWorkstream) -> Dict[str, Any]:
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    svc_jobs = _service_wf_jobs(req)
    job_fallback = _job_items_from_request(req)
    plan_list: List[Dict[str, Any]] = []
    if ws.material_plan:
        try:
            plan_list = json.loads(ws.material_plan)
        except json.JSONDecodeError:
            plan_list = []
    plan_by = {str(p.get("job_item")): p for p in plan_list if isinstance(p, dict)}

    items: List[Dict[str, Any]] = []
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        row = plan_by.get(ji) or {}
        mc = (row.get("material_code") or ws.selected_material_code or "").strip()
        w_cm = float(row.get("width_cm") or 0)
        l_cm = float(row.get("length_cm") or 0)
        in_svc = (ji in svc_jobs) if svc_jobs else (ji in job_fallback if job_fallback else bool(mc))
        is_sel = bool(in_svc and mc and w_cm > 0 and l_cm > 0)
        qty = 1
        req_m = round((l_cm / 100.0) * qty, 4) if is_sel else 0.0
        sz = (row.get("size") or "").strip() or (f"{int(w_cm)}x{int(l_cm)}" if w_cm and l_cm else "")
        sources: List[Dict[str, Any]] = []
        if is_sel and mc and req_m > 0:
            lot = (
                db.query(DbLotInventory)
                .filter(
                    DbLotInventory.material_code == mc,
                    DbLotInventory.status == "ACTIVE",
                )
                .order_by(DbLotInventory.import_date.asc())
                .first()
            )
            sid = (ws.allocated_source_id or "").strip() if (ws.allocated_source_type or "").upper() == "LOT" else ""
            if sid:
                sources = [{"source_type": "LOT", "source_id": sid, "allocated_length_m": req_m, "note": ""}]
            elif lot and (lot.remaining_length_m or 0) + 1e-6 >= req_m:
                sources = [{"source_type": "LOT", "source_id": lot.lot_id, "allocated_length_m": req_m, "note": ""}]
            else:
                sources = [{"source_type": "LOT", "source_id": "", "allocated_length_m": req_m, "note": ""}]
        items.append(
            {
                "item_code": ji,
                "item_name": tmpl["item_name"],
                "is_selected": is_sel,
                "quantity": qty if is_sel else 0,
                "material_code": mc,
                "planned_size": sz,
                "required_width_cm": w_cm if is_sel else 0.0,
                "required_length_cm": l_cm if is_sel else 0.0,
                "required_length_m": req_m if is_sel else 0.0,
                "sources": sources if is_sel else [],
            }
        )
    return {
        "workstream_id": ws.workstream_id,
        "workstream_type": "WINDOW_FILM_INSTALLATION",
        "items": items,
        "change_reason": "",
    }


def _normalize_wf_body(body: Dict[str, Any], ws: DbWorkstream) -> Dict[str, Any]:
    items_in = body.get("items")
    if not isinstance(items_in, list):
        raise _err("WF_INVALID_ITEM_QUANTITY", "items phải là mảng.")
    by_code = {str(x.get("item_code")): x for x in items_in if x.get("item_code")}
    out_items: List[Dict[str, Any]] = []
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        raw = by_code.get(ji) or {}
        is_sel = bool(raw.get("is_selected", False))
        qty = int(raw.get("quantity", 0) or 0)
        if is_sel and qty <= 0:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji} được chọn nhưng quantity phải > 0.")
        if not is_sel:
            qty = 0
        mc = (raw.get("material_code") or "").strip()
        if is_sel and not mc:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji}: bắt buộc material_code.")
        w_cm = float(raw.get("required_width_cm") or 0)
        l_cm = float(raw.get("required_length_cm") or 0)
        req_m = float(raw.get("required_length_m") or 0)
        sz = (raw.get("planned_size") or "").strip()
        if is_sel:
            if req_m <= 0 and l_cm > 0:
                req_m = round((l_cm / 100.0) * max(1, qty), 4)
            if req_m <= 0:
                raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji}: required_length_m phải > 0.")
            if not sz and w_cm and l_cm:
                sz = f"{int(w_cm)}x{int(l_cm)}"
        sources_in = raw.get("sources")
        if not isinstance(sources_in, list):
            sources_in = []
        norm_src: List[Dict[str, Any]] = []
        for s in sources_in:
            if not isinstance(s, dict):
                continue
            st = (s.get("source_type") or "LOT").upper()
            sid = (s.get("source_id") or "").strip()
            al = float(s.get("allocated_length_m") or 0)
            if sid and al > 0:
                norm_src.append(
                    {
                        "source_type": st,
                        "source_id": sid,
                        "allocated_length_m": al,
                        "note": (s.get("note") or "").strip(),
                    }
                )
        if is_sel and not norm_src:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji} được chọn nhưng chưa có nguồn hợp lệ.")
        out_items.append(
            {
                "item_code": ji,
                "item_name": tmpl["item_name"],
                "is_selected": is_sel,
                "quantity": qty if is_sel else 0,
                "material_code": mc if is_sel else "",
                "planned_size": sz if is_sel else "",
                "required_width_cm": w_cm if is_sel else 0.0,
                "required_length_cm": l_cm if is_sel else 0.0,
                "required_length_m": req_m if is_sel else 0.0,
                "sources": norm_src if is_sel else [],
            }
        )
    return {
        "workstream_id": ws.workstream_id,
        "workstream_type": "WINDOW_FILM_INSTALLATION",
        "items": out_items,
        "change_reason": (body.get("change_reason") or "").strip(),
    }


def _validate_wf_source_line(
    db: Session,
    material_code: str,
    s: Dict[str, Any],
    request_id: str,
    admin_override: bool,
    min_width_m: float,
    min_len_m: float,
) -> None:
    st = (s.get("source_type") or "LOT").upper()
    sid = s.get("source_id")
    al = float(s.get("allocated_length_m") or 0)
    if st == "LOT":
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
        if not lot:
            raise _err("WF_SOURCE_NOT_FOUND", f"LOT {sid} không tồn tại.")
        if (lot.material_code or "").strip() != material_code:
            raise _err("WF_SOURCE_MATERIAL_MISMATCH", f"LOT {sid} không cùng material {material_code}.")
        rem = float(lot.remaining_length_m or 0)
        if al > rem + 1e-6:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"LOT {sid} không đủ tồn ({rem}m < {al}m).")
        lock_rid = (lot.locked_by_request_id or "").strip()
        if lot.is_locked and lock_rid and lock_rid != request_id and not admin_override:
            raise _err("WF_SOURCE_LOCKED", f"LOT {sid} đang khóa bởi request khác ({lock_rid}).")
        wm = float(lot.original_width_m or 0)
        if min_width_m > 0 and wm > 0 and wm + 1e-6 < min_width_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"LOT {sid} không đủ khổ rộng cho yêu cầu.")
    elif st == "OFFCUT":
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
        if not oc:
            raise _err("WF_SOURCE_NOT_FOUND", f"Offcut {sid} không tồn tại.")
        if (oc.material_code or "").strip() != material_code:
            raise _err("WF_SOURCE_MATERIAL_MISMATCH", f"Offcut {sid} không cùng material {material_code}.")
        olen = float(oc.length_m or 0)
        ow = float(oc.width_m or 0)
        if al > olen + 1e-6:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ chiều dài ({olen}m < {al}m).")
        if min_width_m > 0 and ow > 0 and ow + 1e-6 < min_width_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ khổ rộng.")
        if min_len_m > 0 and olen + 1e-6 < min_len_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ chiều dài kho.")
        lock_rid = (oc.locked_by_request_id or "").strip()
        if oc.is_locked and lock_rid and lock_rid != request_id and not admin_override:
            raise _err("WF_SOURCE_LOCKED", f"Offcut {sid} đang khóa bởi request khác ({lock_rid}).")
    else:
        raise _err("WF_SOURCE_NOT_FOUND", f"Loại nguồn không hợp lệ: {st}")


def validate_wf_allocation(db: Session, ws: DbWorkstream, alloc: Dict[str, Any], admin_override: bool = False) -> None:
    if ws.workstream_type != "WINDOW_FILM_INSTALLATION":
        raise _err("WF_INVALID_ITEM_QUANTITY", "Chỉ áp dụng cho WINDOW_FILM_INSTALLATION.")
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        mc = (it.get("material_code") or "").strip()
        req_m = float(it.get("required_length_m") or 0)
        w_cm = float(it.get("required_width_cm") or 0)
        l_cm = float(it.get("required_length_cm") or 0)
        min_w_m = (w_cm / 100.0) if w_cm > 0 else 0.0
        min_l_m = (l_cm / 100.0) if l_cm > 0 else 0.0
        srcs = it.get("sources") or []
        tot = sum(float(s.get("allocated_length_m") or 0) for s in srcs)
        if req_m > 0 and tot + 1e-6 < req_m:
            raise _err(
                "WF_ALLOCATION_INSUFFICIENT_LENGTH",
                f"{it.get('item_code')}: tổng nguồn {tot}m < yêu cầu {req_m}m.",
            )
        for s in srcs:
            _validate_wf_source_line(db, mc, s, ws.request_id, admin_override, min_w_m, min_l_m)


def _wf_snapshot_differs(prev: Dict[str, Any], new: Dict[str, Any]) -> bool:
    old_items = {x["item_code"]: x for x in (prev.get("items") or [])}
    for it in new.get("items") or []:
        code = it.get("item_code")
        o = old_items.get(code) or {}
        if bool(it.get("is_selected")) != bool(o.get("is_selected")):
            return True
        if int(it.get("quantity") or 0) != int(o.get("quantity") or 0):
            return True
        if (it.get("material_code") or "") != (o.get("material_code") or ""):
            return True
        if abs(float(it.get("required_length_m") or 0) - float(o.get("required_length_m") or 0)) > 1e-6:
            return True
        ns, osrc = it.get("sources") or [], o.get("sources") or []
        if len(ns) != len(osrc):
            return True
        for i, s in enumerate(ns):
            if i >= len(osrc):
                return True
            os = osrc[i]
            if (s.get("source_type") or "") != (os.get("source_type") or ""):
                return True
            if (s.get("source_id") or "") != (os.get("source_id") or ""):
                return True
            if abs(float(s.get("allocated_length_m") or 0) - float(os.get("allocated_length_m") or 0)) > 1e-6:
                return True
    return False


def _count_sources(alloc: Dict[str, Any]) -> Tuple[int, int]:
    n_items = sum(1 for x in (alloc.get("items") or []) if x.get("is_selected"))
    n_src = 0
    for x in alloc.get("items") or []:
        if not x.get("is_selected"):
            continue
        for s in x.get("sources") or []:
            if (s.get("source_id") or "").strip() and float(s.get("allocated_length_m") or 0) > 0:
                n_src += 1
    return n_items, n_src


def put_wf_allocation(
    db: Session,
    ws_id: str,
    body: Dict[str, Any],
    actor: str = "QL-002",
) -> Dict[str, Any]:
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, {"error": "NOT_FOUND", "message": "Workstream không tồn tại."})
    if ws.workstream_type != "WINDOW_FILM_INSTALLATION":
        raise HTTPException(400, {"error": "INVALID", "message": "Chỉ workstream Phim cách nhiệt."})
    if ws.status != "PENDING_APPROVAL":
        raise HTTPException(400, {"error": "INVALID", "message": f"Chỉ chỉnh khi PENDING_APPROVAL. Hiện: {ws.status}."})

    prev_raw = getattr(ws, "wf_allocation_json", None) or ""
    prev_snap: Dict[str, Any]
    if prev_raw:
        try:
            prev_snap = json.loads(prev_raw)
        except json.JSONDecodeError:
            prev_snap = build_default_wf_allocation(db, ws)
    else:
        prev_snap = build_default_wf_allocation(db, ws)

    admin_ov = bool(body.get("admin_override"))
    alloc = _normalize_wf_body(body, ws)
    validate_wf_allocation(db, ws, alloc, admin_override=admin_ov)

    if _wf_snapshot_differs(prev_snap, alloc):
        if not (alloc.get("change_reason") or "").strip():
            raise _err("WF_CHANGE_REASON_REQUIRED", "Bắt buộc nhập change_reason khi thay đổi phân bổ WF.")

    # legacy: first selected source + first windshield block
    first_sel = next((x for x in alloc["items"] if x.get("is_selected")), None)
    if first_sel:
        srcs = first_sel.get("sources") or []
        if srcs:
            ws.allocated_source_type = (srcs[0].get("source_type") or "LOT").upper()
            ws.allocated_source_id = srcs[0].get("source_id") or ""
        ws.selected_material_code = first_sel.get("material_code") or ws.selected_material_code
        ws.planned_cut_block = first_sel.get("planned_size") or ws.planned_cut_block
        ws.planned_deduction_length_m = float(first_sel.get("required_length_m") or ws.planned_deduction_length_m or 0)

    # sync material_plan material_code / sizes from allocation
    try:
        plan = json.loads(ws.material_plan or "[]")
    except json.JSONDecodeError:
        plan = []
    idx = {r.get("job_item"): i for i, r in enumerate(plan) if isinstance(r, dict)}
    for it in alloc["items"]:
        ji = it.get("item_code")
        if ji not in idx:
            continue
        row = plan[idx[ji]]
        if it.get("is_selected"):
            row["material_code"] = it.get("material_code") or row.get("material_code")
            row["size"] = it.get("planned_size") or row.get("size")
            row["width_cm"] = it.get("required_width_cm") or row.get("width_cm")
            row["length_cm"] = it.get("required_length_cm") or row.get("length_cm")
    ws.material_plan = json.dumps(plan, ensure_ascii=False)
    ws.wf_allocation_json = json.dumps(alloc, ensure_ascii=False)

    n_items, n_src = _count_sources(alloc)
    return {
        "ok": True,
        "workstream_id": ws_id,
        "allocation_status": "READY_FOR_APPROVAL",
        "selected_items_count": n_items,
        "sources_count": n_src,
        "next_step": "MANAGER_APPROVAL",
    }


def validate_wf_allocation_at_approve(db: Session, ws: DbWorkstream) -> None:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return
    validate_wf_allocation(db, ws, alloc, admin_override=False)


def soft_lock_wf_allocation_sources(db: Session, ws: DbWorkstream, approved_by: str, audit_fn) -> int:
    alloc: Dict[str, Any] = {}
    if getattr(ws, "wf_allocation_json", None):
        try:
            alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            sid = (s.get("source_id") or "").strip()
            if sid and float(s.get("allocated_length_m") or 0) > 0:
                flat.append(dict(s))
    if not flat and ws.allocated_source_id:
        flat.append(
            {
                "source_type": (ws.allocated_source_type or "LOT").upper(),
                "source_id": ws.allocated_source_id,
                "allocated_length_m": float(ws.planned_deduction_length_m or 0),
            }
        )
    n = 0
    for s in flat:
        st = (s.get("source_type") or "LOT").upper()
        sid = s.get("source_id")
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if lot:
                lot.is_locked = True
                lot.locked_by_request_id = ws.request_id
                lot.locked_by_workstream_id = ws.workstream_id
                n += 1
                audit_fn(
                    ws.request_id,
                    "SOFT_LOCK_RECORDED",
                    "LOT",
                    sid,
                    "is_locked=false",
                    "is_locked=true",
                    f"Soft lock WF split — {approved_by}",
                    approved_by,
                    ws.workstream_id,
                    ws.workstream_type,
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if oc:
                oc.is_locked = True
                oc.locked_by_request_id = ws.request_id
                oc.locked_by_workstream_id = ws.workstream_id
                n += 1
                audit_fn(
                    ws.request_id,
                    "SOFT_LOCK_RECORDED",
                    "OFFCUT",
                    sid,
                    "is_locked=false",
                    "is_locked=true",
                    f"Soft lock WF split — {approved_by}",
                    approved_by,
                    ws.workstream_id,
                    ws.workstream_type,
                )
    if len(flat) > 1:
        audit_fn(
            ws.request_id,
            "WINDOW_FILM_SOURCE_SPLIT",
            "WORKSTREAM",
            ws.workstream_id,
            None,
            json.dumps([{"id": x.get("source_id"), "m": x.get("allocated_length_m")} for x in flat], ensure_ascii=False),
            "Phê duyệt WF — chia nhiều nguồn",
            approved_by,
            ws.workstream_id,
            ws.workstream_type,
        )
    return n


def commit_wf_multi_source_inventory(db: Session, ws: DbWorkstream, tech_id: str, audit_fn) -> bool:
    alloc: Dict[str, Any] = {}
    if getattr(ws, "wf_allocation_json", None):
        try:
            alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        mc = (it.get("material_code") or "").strip()
        for s in it.get("sources") or []:
            take = float(s.get("allocated_length_m") or 0)
            sid = (s.get("source_id") or "").strip()
            if sid and take > 0:
                x = dict(s)
                x["_material_code"] = mc
                flat.append(x)
    if not flat:
        return False
    for s in flat:
        st = (s.get("source_type") or "LOT").upper()
        sid = s.get("source_id")
        take = float(s.get("allocated_length_m") or 0)
        mc = s.get("_material_code") or ws.selected_material_code
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if lot and (lot.material_code or "").strip() == (mc or "").strip():
                before = float(lot.remaining_length_m or 0)
                lot.remaining_length_m = round(max(0.0, before - take), 3)
                after = lot.remaining_length_m
                lot.is_locked = False
                lot.is_opened = True
                lot.locked_by_request_id = None
                lot.locked_by_workstream_id = None
                audit_fn(
                    ws.request_id,
                    "ISSUE_FROM_LOT",
                    "LOT",
                    sid,
                    f"{before}m",
                    f"{after}m",
                    f"Commit WF multi-source — KTV {tech_id}",
                    tech_id,
                    ws.workstream_id,
                    ws.workstream_type,
                )
                audit_fn(
                    ws.request_id,
                    "RELEASE_LOCK",
                    "LOT",
                    sid,
                    "is_locked=true",
                    "is_locked=false",
                    "Giải phóng lock sau commit WF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if oc and (oc.material_code or "").strip() == (mc or "").strip():
                before = float(oc.length_m or 0)
                new_len = round(max(0.0, before - take), 3)
                oc.length_m = new_len
                oc.area_m2 = round((oc.width_m or 0) * new_len, 3) if oc.width_m else 0.0
                if new_len <= 1e-6:
                    oc.offcut_status = "USED"
                    oc.status = "USED"
                oc.is_locked = False
                oc.locked_by_request_id = None
                oc.locked_by_workstream_id = None
                audit_fn(
                    ws.request_id,
                    "ISSUE_FROM_OFFCUT",
                    "OFFCUT",
                    sid,
                    f"{before}m",
                    f"{new_len}m",
                    f"Commit WF multi-source — KTV {tech_id}",
                    tech_id,
                    ws.workstream_id,
                    ws.workstream_type,
                )
                audit_fn(
                    ws.request_id,
                    "RELEASE_LOCK",
                    "OFFCUT",
                    sid,
                    "is_locked=true",
                    "is_locked=false",
                    "Giải phóng lock sau commit WF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )
    return True


def wf_allocation_has_offcut(ws: DbWorkstream) -> bool:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return False
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return False
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            if (s.get("source_type") or "").upper() == "OFFCUT" and (s.get("source_id") or "").strip():
                return True
    return False


def wf_allocation_has_multi_sources(ws: DbWorkstream) -> bool:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return False
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return False
    n = 0
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            if (s.get("source_id") or "").strip() and float(s.get("allocated_length_m") or 0) > 0:
                n += 1
    return n > 1
