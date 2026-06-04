# -*- coding: utf-8 -*-
"""PPF allocation nhiều nguồn LOT/OFFCUT — validate + lưu proposal (không trừ kho)."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import DbLotInventory, DbOffcutInventory, DbWorkstream

PPF_FULL_REQUIRED_M = 13.0
DEFAULT_PPF_BLOCK = "152x1300"

# Định nghĩa hạng mục PPF (mặc định chỉ Full xe được chọn)
PPF_ITEM_DEFINITIONS: List[Dict[str, Any]] = [
    {"item_code": "FULL_VEHICLE_PPF", "item_name": "Full xe", "default_selected": True, "default_qty": 1, "default_block": DEFAULT_PPF_BLOCK, "default_required_m": PPF_FULL_REQUIRED_M},
    {"item_code": "HOOD_PPF", "item_name": "Nắp capo", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "FRONT_BUMPER_PPF", "item_name": "Cản trước", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "REAR_BUMPER_PPF", "item_name": "Cản sau", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "MIRROR_PPF", "item_name": "Gương chiếu hậu", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "DOOR_HANDLE_PPF", "item_name": "Tay nắm cửa", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "DOOR_EDGE_PPF", "item_name": "Mép cửa", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "DOOR_JAMB_PPF", "item_name": "Hốc cửa", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "LIGHT_CLUSTER_PPF", "item_name": "Cụm đèn", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "INTERIOR_SCREEN_PPF", "item_name": "Màn hình / nội thất", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
    {"item_code": "OTHER_PPF", "item_name": "Khác", "default_selected": False, "default_qty": 0, "default_block": "", "default_required_m": 0.0},
]


def _err(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": code, "message": message})


def build_default_ppf_allocation(ws: DbWorkstream) -> Dict[str, Any]:
    """Proposal mặc định từ workstream hiện tại (1 nguồn nếu có)."""
    mc = (ws.selected_material_code or "T-TYPE").strip()
    srcs: List[Dict[str, Any]] = []
    if ws.allocated_source_id and ws.allocated_source_type:
        srcs.append(
            {
                "source_type": (ws.allocated_source_type or "LOT").upper(),
                "source_id": ws.allocated_source_id,
                "allocated_length_m": float(ws.planned_deduction_length_m or PPF_FULL_REQUIRED_M),
            }
        )
    elif ws.planned_deduction_length_m:
        srcs.append({"source_type": "LOT", "source_id": "", "allocated_length_m": float(ws.planned_deduction_length_m)})
    items = []
    for d in PPF_ITEM_DEFINITIONS:
        row = {
            "item_code": d["item_code"],
            "item_name": d["item_name"],
            "is_selected": d["default_selected"],
            "quantity": d["default_qty"] if d["default_selected"] else 0,
            "planned_cut_block": d["default_block"] if d["default_selected"] else "",
            "required_length_m": float(d["default_required_m"]) if d["default_selected"] else 0.0,
            "sources": list(srcs) if d["item_code"] == "FULL_VEHICLE_PPF" and d["default_selected"] else [],
        }
        if row["item_code"] == "FULL_VEHICLE_PPF" and d["default_selected"] and not row["sources"]:
            row["sources"] = [
                {"source_type": "LOT", "source_id": "", "allocated_length_m": PPF_FULL_REQUIRED_M},
            ]
        items.append(row)
    return {
        "workstream_id": ws.workstream_id,
        "workstream_type": "PPF_INSTALLATION",
        "ppf_type": mc,
        "required_total_length_m": PPF_FULL_REQUIRED_M,
        "items": items,
        "change_reason": "",
    }


def _normalize_allocation(body: Dict[str, Any], ws: DbWorkstream) -> Dict[str, Any]:
    ppf_type = (body.get("ppf_type") or ws.selected_material_code or "T-TYPE").strip()
    items_in = body.get("items")
    if not isinstance(items_in, list) or not items_in:
        raise _err("PPF_INVALID_ITEM_QUANTITY", "items phải là mảng không rỗng.")
    by_code = {str(x.get("item_code")): x for x in items_in}
    items_out: List[Dict[str, Any]] = []
    for d in PPF_ITEM_DEFINITIONS:
        code = d["item_code"]
        raw = by_code.get(code) or {}
        is_sel = bool(raw.get("is_selected", d["default_selected"]))
        qty = int(raw.get("quantity", 0) or 0)
        if is_sel and qty <= 0:
            raise _err("PPF_INVALID_ITEM_QUANTITY", f"Hạng mục {code} được chọn nhưng quantity phải > 0.")
        if not is_sel:
            qty = 0
        block = (raw.get("planned_cut_block") or "").strip()
        req_len = float(raw.get("required_length_m") or 0)
        if is_sel and code == "FULL_VEHICLE_PPF":
            if not block:
                block = DEFAULT_PPF_BLOCK
            if req_len <= 0:
                req_len = PPF_FULL_REQUIRED_M
        sources = raw.get("sources")
        if not isinstance(sources, list):
            sources = []
        norm_sources = []
        for s in sources:
            if not isinstance(s, dict):
                continue
            st = (s.get("source_type") or "LOT").upper()
            sid = (s.get("source_id") or "").strip()
            al = float(s.get("allocated_length_m") or 0)
            if sid and al > 0:
                norm_sources.append({"source_type": st, "source_id": sid, "allocated_length_m": al, "note": (s.get("note") or "").strip()})
        items_out.append(
            {
                "item_code": code,
                "item_name": d["item_name"],
                "is_selected": is_sel,
                "quantity": qty,
                "planned_cut_block": block,
                "required_length_m": req_len if is_sel else 0.0,
                "sources": norm_sources if is_sel else [],
            }
        )
    return {
        "workstream_id": ws.workstream_id,
        "workstream_type": "PPF_INSTALLATION",
        "ppf_type": ppf_type,
        "required_total_length_m": float(body.get("required_total_length_m") or PPF_FULL_REQUIRED_M),
        "items": items_out,
        "change_reason": (body.get("change_reason") or "").strip(),
    }


def _validate_sources_db(
    db: Session,
    ppf_type: str,
    sources: List[Dict[str, Any]],
    request_id: str,
    admin_override: bool = False,
) -> None:
    for s in sources:
        st = s["source_type"]
        sid = s["source_id"]
        al = float(s["allocated_length_m"])
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if not lot:
                raise _err("PPF_SOURCE_NOT_FOUND", f"LOT {sid} không tồn tại.")
            if (lot.material_code or "").strip() != ppf_type:
                raise _err("PPF_SOURCE_MATERIAL_MISMATCH", f"LOT {sid} không cùng loại PPF {ppf_type}.")
            rem = float(lot.remaining_length_m or 0)
            if al > rem + 1e-6:
                raise _err("PPF_SOURCE_INSUFFICIENT_BALANCE", f"LOT {sid} không đủ tồn ({rem}m < {al}m).")
            lock_rid = (lot.locked_by_request_id or "").strip()
            if lot.is_locked and lock_rid and lock_rid != request_id and not admin_override:
                raise _err("PPF_SOURCE_LOCKED", f"LOT {sid} đang khóa bởi request khác ({lock_rid}).")
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if not oc:
                raise _err("PPF_SOURCE_NOT_FOUND", f"Offcut {sid} không tồn tại.")
            if (oc.material_code or "").strip() != ppf_type:
                raise _err("PPF_SOURCE_MATERIAL_MISMATCH", f"Offcut {sid} không cùng loại PPF {ppf_type}.")
            rem = float(oc.length_m or 0)
            if al > rem + 1e-6:
                raise _err("PPF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ chiều dài ({rem}m < {al}m).")
            lock_rid = (oc.locked_by_request_id or "").strip()
            if oc.is_locked and lock_rid and lock_rid != request_id and not admin_override:
                raise _err("PPF_SOURCE_LOCKED", f"Offcut {sid} đang khóa bởi request khác ({lock_rid}).")
        else:
            raise _err("PPF_SOURCE_NOT_FOUND", f"Loại nguồn không hợp lệ: {st}")


def _full_vehicle_total_allocated(items: List[Dict[str, Any]]) -> float:
    for it in items:
        if it.get("item_code") == "FULL_VEHICLE_PPF" and it.get("is_selected"):
            return sum(float(s.get("allocated_length_m") or 0) for s in it.get("sources") or [])
    return 0.0


def _full_vehicle_required(items: List[Dict[str, Any]]) -> float:
    for it in items:
        if it.get("item_code") == "FULL_VEHICLE_PPF" and it.get("is_selected"):
            return float(it.get("required_length_m") or PPF_FULL_REQUIRED_M)
    return 0.0


def validate_ppf_allocation_at_approve(db: Session, ws: DbWorkstream) -> None:
    """Kiểm tra lại tồn tại/đủ mét trước khi Quản lý duyệt."""
    raw = getattr(ws, "ppf_allocation_json", None) or ""
    if not raw.strip():
        return
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return
    validate_ppf_allocation(db, ws, alloc, admin_override=False)


def validate_ppf_allocation(db: Session, ws: DbWorkstream, alloc: Dict[str, Any], admin_override: bool = False) -> None:
    if ws.workstream_type != "PPF_INSTALLATION":
        raise _err("PPF_INVALID_ITEM_QUANTITY", "Chỉ áp dụng cho workstream PPF_INSTALLATION.")
    items = alloc.get("items") or []
    ppf_type = alloc.get("ppf_type") or "T-TYPE"

    full_sel = next((x for x in items if x.get("item_code") == "FULL_VEHICLE_PPF" and x.get("is_selected")), None)
    if not full_sel:
        raise _err("PPF_INVALID_ITEM_QUANTITY", "Phải chọn hạng mục Full xe (PPF mặc định).")

    req = _full_vehicle_required(items)
    tot = _full_vehicle_total_allocated(items)
    if tot + 1e-6 < req:
        raise _err(
            "PPF_ALLOCATION_INSUFFICIENT_LENGTH",
            f"PPF Full xe cần {req}m. Nguồn đã chọn tổng {tot}m — chưa đủ chiều dài.",
        )

    for it in items:
        if not it.get("is_selected"):
            continue
        req_i = float(it.get("required_length_m") or 0)
        srcs = it.get("sources") or []
        sum_i = sum(float(s.get("allocated_length_m") or 0) for s in srcs)
        if req_i > 0 and sum_i + 1e-6 < req_i:
            raise _err(
                "PPF_ALLOCATION_INSUFFICIENT_LENGTH",
                f"Hạng mục {it.get('item_code')}: tổng nguồn {sum_i}m < yêu cầu {req_i}m.",
            )
        for s in srcs:
            _validate_sources_db(db, ppf_type, [s], ws.request_id, admin_override=admin_override)


def _allocation_differs_from_snapshot(new_alloc: Dict[str, Any], snapshot: Dict[str, Any]) -> bool:
    """True nếu cần change_reason (đổi loại, nguồn, chia, size, tick thêm hạng mục)."""
    if (new_alloc.get("ppf_type") or "") != (snapshot.get("ppf_type") or ""):
        return True
    old_items = {x["item_code"]: x for x in (snapshot.get("items") or [])}
    for it in new_alloc.get("items") or []:
        code = it.get("item_code")
        o = old_items.get(code) or {}
        if bool(it.get("is_selected")) != bool(o.get("is_selected")):
            return True
        if int(it.get("quantity") or 0) != int(o.get("quantity") or 0):
            return True
        if (it.get("planned_cut_block") or "") != (o.get("planned_cut_block") or ""):
            return True
        if abs(float(it.get("required_length_m") or 0) - float(o.get("required_length_m") or 0)) > 1e-6:
            return True
        ns = it.get("sources") or []
        osrc = o.get("sources") or []
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


def put_ppf_allocation(
    db: Session,
    ws_id: str,
    body: Dict[str, Any],
    actor: str = "QL-002",
) -> Dict[str, Any]:
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, {"error": "NOT_FOUND", "message": "Workstream không tồn tại."})
    if ws.workstream_type != "PPF_INSTALLATION":
        raise HTTPException(400, {"error": "INVALID", "message": "Chỉ workstream PPF."})
    if ws.status != "PENDING_APPROVAL":
        raise HTTPException(400, {"error": "INVALID", "message": f"Chỉ chỉnh khi PENDING_APPROVAL. Hiện: {ws.status}."})

    prev_snapshot: Dict[str, Any]
    if getattr(ws, "ppf_allocation_json", None):
        try:
            prev_snapshot = json.loads(ws.ppf_allocation_json)
        except json.JSONDecodeError:
            prev_snapshot = build_default_ppf_allocation(ws)
    else:
        prev_snapshot = build_default_ppf_allocation(ws)

    admin_ov = bool(body.get("admin_override"))
    alloc = _normalize_allocation(body, ws)
    validate_ppf_allocation(db, ws, alloc, admin_override=admin_ov)

    if _allocation_differs_from_snapshot(alloc, prev_snapshot):
        if not (alloc.get("change_reason") or "").strip():
            raise _err("PPF_CHANGE_REASON_REQUIRED", "Bắt buộc nhập change_reason khi thay đổi phân bổ / loại PPF / hạng mục.")

    # Cập nhật legacy fields từ Full xe
    full = next((x for x in alloc["items"] if x["item_code"] == "FULL_VEHICLE_PPF"), None)
    if full and full.get("is_selected"):
        ws.selected_material_code = alloc["ppf_type"]
        ws.planned_cut_block = full.get("planned_cut_block") or DEFAULT_PPF_BLOCK
        ws.planned_deduction_length_m = float(full.get("required_length_m") or PPF_FULL_REQUIRED_M)
        srcs = full.get("sources") or []
        if srcs:
            ws.allocated_source_type = (srcs[0].get("source_type") or "LOT").upper()
            ws.allocated_source_id = srcs[0].get("source_id") or ""
        else:
            ws.allocated_source_type = None
            ws.allocated_source_id = None

    ws.ppf_allocation_json = json.dumps(alloc, ensure_ascii=False)

    tot = _full_vehicle_total_allocated(alloc["items"])
    req = _full_vehicle_required(alloc["items"])

    return {
        "ok": True,
        "workstream_id": ws_id,
        "allocation_status": "READY_FOR_APPROVAL",
        "required_total_length_m": req,
        "allocated_total_length_m": round(tot, 3),
        "sources_count": sum(len((x.get("sources") or [])) for x in alloc["items"] if x.get("is_selected")),
        "next_step": "MANAGER_APPROVAL",
    }


def audit_ppf_allocation_save(db, ws: DbWorkstream, prev: str, new_json: str, reason: str, actor: str, audit_fn) -> None:
    """audit_fn(request_id, type, source_type, source_id, before, after, reason, actor, ws_id, ws_type)"""
    audit_fn(
        ws.request_id,
        "PPF_ALLOCATION_UPDATED",
        "WORKSTREAM",
        ws.workstream_id,
        prev[:2000] if prev else None,
        new_json[:2000] if new_json else None,
        reason or "Cập nhật phân bổ PPF trước duyệt",
        actor,
        ws.workstream_id,
        ws.workstream_type,
    )


def soft_lock_ppf_allocation_sources(db: Session, ws: DbWorkstream, approved_by: str, audit_fn) -> int:
    """Soft lock tất cả nguồn trong allocation. Trả về số nguồn đã lock."""
    alloc = {}
    if getattr(ws, "ppf_allocation_json", None):
        try:
            alloc = json.loads(ws.ppf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    sources_flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            sid = (s.get("source_id") or "").strip()
            if sid and float(s.get("allocated_length_m") or 0) > 0:
                sources_flat.append(s)
    if not sources_flat and ws.allocated_source_id:
        sources_flat.append(
            {
                "source_type": (ws.allocated_source_type or "LOT").upper(),
                "source_id": ws.allocated_source_id,
                "allocated_length_m": float(ws.planned_deduction_length_m or PPF_FULL_REQUIRED_M),
            }
        )

    n = 0
    for s in sources_flat:
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
                    f"Soft lock PPF split — {approved_by}",
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
                    f"Soft lock PPF split — {approved_by}",
                    approved_by,
                    ws.workstream_id,
                    ws.workstream_type,
                )
    if len(sources_flat) > 1:
        audit_fn(
            ws.request_id,
            "PPF_SOURCE_SPLIT",
            "WORKSTREAM",
            ws.workstream_id,
            None,
            json.dumps([{"id": x.get("source_id"), "m": x.get("allocated_length_m")} for x in sources_flat], ensure_ascii=False),
            "Phê duyệt PPF — chia nhiều nguồn",
            approved_by,
            ws.workstream_id,
            ws.workstream_type,
        )
    return n


def commit_ppf_multi_source_inventory(db: Session, ws: DbWorkstream, tech_id: str, audit_fn) -> bool:
    """Trừ kho theo từng dòng nguồn trong ppf_allocation_json. True nếu đã xử lý ≥1 nguồn."""
    alloc = {}
    if getattr(ws, "ppf_allocation_json", None):
        try:
            alloc = json.loads(ws.ppf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    sources_flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            take = float(s.get("allocated_length_m") or 0)
            if (s.get("source_id") or "").strip() and take > 0:
                sources_flat.append(dict(s))

    if not sources_flat:
        return False

    for s in sources_flat:
        st = (s.get("source_type") or "LOT").upper()
        sid = s.get("source_id")
        take = float(s.get("allocated_length_m") or 0)
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if lot:
                before = float(lot.remaining_length_m or 0)
                lot.remaining_length_m = round(max(0.0, before - take), 3)
                after = lot.remaining_length_m
                lot.is_locked = False
                lot.is_opened = True
                lot.locked_by_request_id = None
                lot.locked_by_workstream_id = None
                audit_fn(
                    ws.request_id,
                    f"ISSUE_FROM_LOT",
                    "LOT",
                    sid,
                    f"{before}m",
                    f"{after}m",
                    f"Commit PPF multi-source — KTV {tech_id}",
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
                    f"Giải phóng lock sau commit PPF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if oc:
                before = float(oc.length_m or 0)
                new_len = round(max(0.0, before - take), 3)
                oc.length_m = new_len
                oc.area_m2 = round((oc.width_m or 0) * new_len, 3) if oc.width_m else 0.0
                if new_len <= 1e-6:
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
                    f"Commit PPF multi-source — KTV {tech_id}",
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
                    "Giải phóng lock sau commit PPF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )

    return True


def ppf_allocation_has_multi_sources(ws: DbWorkstream) -> bool:
    if not getattr(ws, "ppf_allocation_json", None):
        return False
    try:
        alloc = json.loads(ws.ppf_allocation_json)
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
