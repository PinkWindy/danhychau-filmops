# -*- coding: utf-8 -*-
"""Inventory admin APIs — mounted from main.py. All ops write DbInventoryTransaction + DbAuditLog."""
import datetime
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Query as QueryParam
from sqlalchemy.orm import Session

from database import (
    DbLotInventory,
    DbOffcutInventory,
    DbInventoryTransaction,
    DbAuditLog,
    DbWorkstream,
    DbMaterialPreference,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

LOT_TERMINAL = frozenset({"CLOSED", "CLEARED", "SCRAPPED"})
# LOT mẫu cho smoke / admin — không đưa vào picker phân bổ chung (tránh nhiễu sau test)
LOT_DEMO_IDS_HIDE_FROM_ACTIVE_OPTIONS = frozenset(
    {"LOT-DEMO-CLEARED-001", "LOT-DEMO-DEPLETED-001", "LOT-DEMO-LOCKED-001"}
)
# Manual xuất kho: không cho khi đã terminal hoặc DEPLETED / hết tồn
LOT_MANUAL_ISSUE_BLOCKED = frozenset({"CLOSED", "CLEARED", "SCRAPPED", "DEPLETED"})
OFFCUT_ISSUEABLE = frozenset({"AVAILABLE", "PARTIALLY_USED"})
OFFCUT_TERMINAL = frozenset({"USED", "CLEARED", "SCRAPPED", "LOST", "QUALITY_FAILED"})


def _uid():
    return uuid.uuid4().hex[:8].upper()


def _now_iso():
    return datetime.datetime.utcnow().isoformat() + "Z"


def _norm_lot_status(lot: DbLotInventory) -> str:
    s = (lot.lot_status or lot.status or "ACTIVE").upper()
    if s == "ACTIVE":
        if lot.is_locked:
            return "LOCKED"
        if (lot.remaining_length_m or 0) <= 0:
            return "DEPLETED"
        return "IN_USE" if lot.is_opened else "NEW"
    return s


def _norm_offcut_status(o: DbOffcutInventory) -> str:
    if (o.area_m2 or 0) <= 0 or (o.length_m or 0) <= 0 or (o.width_m or 0) <= 0:
        s = (o.offcut_status or o.status or "CLEARED").upper()
        if s in ("ACTIVE", "AVAILABLE", "USED"):
            return "CLEARED"
        return s

    s = (o.offcut_status or o.status or "AVAILABLE").upper()
    if s == "ACTIVE":
        return "AVAILABLE"
    return s


def assert_source_valid_for_wf6_commit(db: Session, ws: DbWorkstream):
    """Raise HTTPException if allocated LOT/OFFCUT cannot be committed (cleared / insufficient)."""
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and getattr(ws, "wf_allocation_json", None):
        try:
            wf_alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            wf_alloc = {}
        items = wf_alloc.get("items") or []
        any_src = False
        for it in items:
            if not it.get("is_selected"):
                continue
            mc = (it.get("material_code") or "").strip()
            for s in it.get("sources") or []:
                sid = (s.get("source_id") or "").strip()
                st = (s.get("source_type") or "LOT").upper()
                need = float(s.get("allocated_length_m") or 0)
                if not sid or need <= 1e-9:
                    continue
                any_src = True
                if st == "LOT":
                    lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
                    if not lot:
                        raise HTTPException(
                            400,
                            f"Nguồn LOT {sid} không tồn tại — Quản lý cần chọn lại nguồn cho luồng {ws.workstream_id}.",
                        )
                    ls = _norm_lot_status(lot)
                    if ls in LOT_TERMINAL or ls == "DEPLETED" or (lot.remaining_length_m or 0) <= 1e-9:
                        raise HTTPException(
                            400,
                            f"LOT {sid} không còn dùng được (trạng thái {ls}, tồn {lot.remaining_length_m}m). Quản lý cần chọn lại nguồn.",
                        )
                    if (lot.material_code or "").strip() != mc:
                        raise HTTPException(400, f"LOT {sid} không khớp material {mc} cho hạng mục WF.")
                    if (lot.remaining_length_m or 0) < need - 1e-6:
                        raise HTTPException(
                            400,
                            f"LOT {sid} không đủ tồn ({lot.remaining_length_m}m). Cần {need}m.",
                        )
                elif st == "OFFCUT":
                    oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
                    if not oc:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} không tồn tại — Quản lý cần chọn lại nguồn.",
                        )
                    eff = _norm_offcut_status(oc)
                    if eff in OFFCUT_TERMINAL:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} đã {eff} — không thể trừ kho. Quản lý cần chọn lại nguồn.",
                        )
                    if eff not in OFFCUT_ISSUEABLE or (oc.length_m or 0) <= 0 or (oc.width_m or 0) <= 0:
                        raise HTTPException(400, f"Mảnh dư {sid} không còn khả dụng ({eff}) — không thể complete.")
                    if (oc.material_code or "").strip() != mc:
                        raise HTTPException(400, f"Offcut {sid} không khớp material {mc}.")
                    if (oc.length_m or 0) < need - 1e-6:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} không đủ chiều dài ({oc.length_m}m). Cần {need}m.",
                        )
                else:
                    raise HTTPException(400, f"Loại nguồn không hợp lệ: {st}")
        if any_src:
            return

    if ws.workstream_type == "PPF_INSTALLATION" and getattr(ws, "ppf_allocation_json", None):
        try:
            alloc = json.loads(ws.ppf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
        items = alloc.get("items") or []
        any_src = False
        for it in items:
            if not it.get("is_selected"):
                continue
            for s in it.get("sources") or []:
                sid = (s.get("source_id") or "").strip()
                st = (s.get("source_type") or "LOT").upper()
                need = float(s.get("allocated_length_m") or 0)
                if not sid or need <= 1e-9:
                    continue
                any_src = True
                if st == "LOT":
                    lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
                    if not lot:
                        raise HTTPException(
                            400,
                            f"Nguồn LOT {sid} không tồn tại — Quản lý cần chọn lại nguồn cho luồng {ws.workstream_id}.",
                        )
                    ls = _norm_lot_status(lot)
                    if ls in LOT_TERMINAL or ls == "DEPLETED" or (lot.remaining_length_m or 0) <= 1e-9:
                        raise HTTPException(
                            400,
                            f"LOT {sid} không còn dùng được (trạng thái {ls}, tồn {lot.remaining_length_m}m). Quản lý cần chọn lại nguồn.",
                        )
                    if (lot.remaining_length_m or 0) < need - 1e-6:
                        raise HTTPException(
                            400,
                            f"LOT {sid} không đủ tồn ({lot.remaining_length_m}m). Cần {need}m.",
                        )
                elif st == "OFFCUT":
                    oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
                    if not oc:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} không tồn tại — Quản lý cần chọn lại nguồn.",
                        )
                    eff = _norm_offcut_status(oc)
                    if eff in OFFCUT_TERMINAL:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} đã {eff} — không thể trừ kho. Quản lý cần chọn lại nguồn.",
                        )
                    if eff not in OFFCUT_ISSUEABLE or (oc.length_m or 0) <= 0 or (oc.width_m or 0) <= 0:
                        raise HTTPException(400, f"Mảnh dư {sid} không còn khả dụng ({eff}) — không thể complete.")
                    if (oc.length_m or 0) < need - 1e-6:
                        raise HTTPException(
                            400,
                            f"Mảnh dư {sid} không đủ chiều dài ({oc.length_m}m). Cần {need}m.",
                        )
                else:
                    raise HTTPException(400, f"Loại nguồn không hợp lệ: {st}")
        if any_src:
            return

    sid = ws.allocated_source_id
    st = (ws.allocated_source_type or "LOT").upper()
    if not sid:
        return
    need = float(ws.actual_length_m or ws.planned_deduction_length_m or 0)
    if st == "LOT":
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
        if not lot:
            raise HTTPException(400, f"Nguồn LOT {sid} không tồn tại — Quản lý cần chọn lại nguồn cho luồng {ws.workstream_id}.")
        ls = _norm_lot_status(lot)
        if ls in LOT_TERMINAL or ls == "DEPLETED" or (lot.remaining_length_m or 0) <= 1e-9:
            raise HTTPException(
                400,
                f"LOT {sid} không còn dùng được (trạng thái {ls}, tồn {lot.remaining_length_m}m). Quản lý cần chọn lại nguồn.",
            )
        if (lot.remaining_length_m or 0) < need - 1e-6:
            raise HTTPException(400, f"LOT {sid} không đủ tồn ({lot.remaining_length_m}m). Quản lý cần điều chỉnh nguồn.")
    elif st == "OFFCUT":
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
        if not oc:
            raise HTTPException(400, f"Mảnh dư {sid} không tồn tại — Quản lý cần chọn lại nguồn.")
        eff = _norm_offcut_status(oc)
        if eff in OFFCUT_TERMINAL:
            raise HTTPException(
                400,
                f"Mảnh dư {sid} đã {eff} — không thể trừ kho. Quản lý cần chọn lại nguồn.",
            )
        if eff not in OFFCUT_ISSUEABLE or (oc.length_m or 0) <= 0 or (oc.width_m or 0) <= 0:
            raise HTTPException(400, f"Mảnh dư {sid} không còn khả dụng ({eff}) — không thể complete.")


def _inv_txn_id():
    return f"INV-TXN-{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{_uid()}"


def _audit_inv(
    db: Session,
    *,
    event_type: str,
    source_type: str,
    source_id: str,
    before_value: str,
    after_value: str,
    reason: str,
    actor: str,
    request_id: Optional[str] = None,
    workstream_id: Optional[str] = None,
):
    sfx = (workstream_id or request_id or "INV")[-4:].upper()
    ts = datetime.date.today().strftime("%Y%m%d")
    u1, u2 = _uid(), _uid()
    db.add(
        DbAuditLog(
            log_id=f"AUD-{ts}-{sfx}-{u1}",
            transaction_id=f"TXN-{ts}-{sfx}-{u2}",
            request_id=request_id,
            workstream_id=workstream_id,
            workstream_type=None,
            cut_group_id=None,
            transaction_type=event_type,
            transaction_status="CONFIRMED",
            source_type=source_type,
            source_id=source_id,
            before_value=before_value,
            after_value=after_value,
            reason=reason,
            actor=actor,
            timestamp=_now_iso(),
        )
    )


def _add_inv_txn(
    db: Session,
    *,
    transaction_type: str,
    source_type: str,
    source_id: str,
    material_code: str,
    material_name: Optional[str],
    width_m: Optional[float],
    length_m: Optional[float],
    area_m2: Optional[float],
    quantity_m: Optional[float],
    balance_unit: str,
    before_balance: Optional[float],
    after_balance: Optional[float],
    before_status: Optional[str],
    after_status: Optional[str],
    reason: Optional[str],
    related_request_id: Optional[str],
    related_workstream_id: Optional[str],
    related_job_card_id: Optional[str],
    parent_lot_id: Optional[str],
    parent_offcut_id: Optional[str],
    performed_by: str,
    performed_role: str,
    channel: str = "WEB",
    note: Optional[str] = None,
):
    db.add(
        DbInventoryTransaction(
            transaction_id=_inv_txn_id(),
            transaction_type=transaction_type,
            source_type=source_type,
            source_id=source_id,
            material_code=material_code or "",
            material_name=material_name,
            width_m=width_m,
            length_m=length_m,
            area_m2=area_m2,
            quantity_m=quantity_m,
            balance_unit=balance_unit,
            before_balance=before_balance,
            after_balance=after_balance,
            before_status=before_status,
            after_status=after_status,
            reason=reason,
            related_request_id=related_request_id,
            related_workstream_id=related_workstream_id,
            related_job_card_id=related_job_card_id,
            parent_lot_id=parent_lot_id,
            parent_offcut_id=parent_offcut_id,
            performed_by=performed_by,
            performed_role=performed_role,
            performed_at=_now_iso(),
            channel=channel,
            note=note,
        )
    )


def create_offcut_from_workstream_return(
    db: Session,
    *,
    offcut_id: str,
    material_code: str,
    width_m: float,
    length_m: float,
    quality_status: str,
    storage_location: str,
    request_id: str,
    workstream_id: str,
    job_card_id: Optional[str],
    performed_by: str,
    note: Optional[str],
    parent_lot_id: Optional[str],
    parent_offcut_id: Optional[str],
    film_type: str,
) -> DbOffcutInventory:
    """
    Ghi mảnh dư khi KTV hoàn tất luồng — cùng các cột chính với nhập thủ công (/offcuts/import),
    thêm bút toán kho + audit (IMPORT_OFFCUT_WORKSTREAM).
    """
    area_m2 = round(float(width_m) * float(length_m), 3)
    qs = (quality_status or "NORMAL").strip().upper()
    if qs not in ("GOOD", "NORMAL", "POOR"):
        qs = "NORMAL"
    ft = (film_type or "WINDOW_FILM").strip() or "WINDOW_FILM"
    pl = (parent_lot_id or "").strip() or None
    po = (parent_offcut_id or "").strip() or None
    oc = DbOffcutInventory(
        offcut_id=offcut_id,
        parent_lot_id=pl,
        parent_offcut_id=po,
        material_code=(material_code or "JB20").strip(),
        film_type=ft,
        width_m=float(width_m),
        length_m=float(length_m),
        area_m2=area_m2,
        quality_status=qs,
        offcut_status="AVAILABLE",
        is_locked=False,
        storage_location=(storage_location or "OFFCUT-RACK-C").strip(),
        created_from_request_id=(request_id or "").strip() or None,
        created_reason=f"Mảnh dư khi hoàn tất luồng {workstream_id}",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note=(note or "").strip() or None,
    )
    db.add(oc)
    reason = f"Mảnh dư sau hoàn tất luồng {workstream_id}"
    _add_inv_txn(
        db,
        transaction_type="IMPORT_OFFCUT_WORKSTREAM",
        source_type="OFFCUT",
        source_id=offcut_id,
        material_code=oc.material_code,
        material_name=oc.material_name,
        width_m=width_m,
        length_m=length_m,
        area_m2=area_m2,
        quantity_m=area_m2,
        balance_unit="SQUARE_METER",
        before_balance=0.0,
        after_balance=area_m2,
        before_status=None,
        after_status="AVAILABLE",
        reason=reason,
        related_request_id=request_id,
        related_workstream_id=workstream_id,
        related_job_card_id=job_card_id,
        parent_lot_id=pl,
        parent_offcut_id=po,
        performed_by=performed_by or "KTV-003",
        performed_role="TECHNICIAN",
        note=note,
    )
    _audit_inv(
        db,
        event_type="OFFCUT_IMPORTED_WORKSTREAM",
        source_type="OFFCUT",
        source_id=offcut_id,
        before_value="None",
        after_value=f"{area_m2}m²",
        reason=reason,
        actor=performed_by or "KTV-003",
        request_id=request_id,
        workstream_id=workstream_id,
    )
    return oc


def _first_import_actor_by_source(db: Session, source_ids: list, txn_types: tuple) -> dict:
    """Dòng sổ nhập kho đầu tiên theo source_id → người thực hiện & thời điểm ghi nhận."""
    if not source_ids:
        return {}
    rows = (
        db.query(DbInventoryTransaction)
        .filter(DbInventoryTransaction.source_id.in_(source_ids))
        .filter(DbInventoryTransaction.transaction_type.in_(txn_types))
        .order_by(DbInventoryTransaction.performed_at.asc())
        .all()
    )
    meta = {}
    for r in rows:
        sid = (r.source_id or "").strip()
        if sid and sid not in meta:
            meta[sid] = {
                "import_performed_by": (r.performed_by or "").strip(),
                "import_performed_at": (r.performed_at or "").strip(),
            }
    return meta


def _orm_columns_dict(obj) -> dict:
    """Chuyển một dòng ORM SQLAlchemy thành dict (chỉ cột bảng) — dùng cho JSON API."""
    from sqlalchemy.inspection import inspect as sa_inspect

    return {c.key: getattr(obj, c.key, None) for c in sa_inspect(obj).mapper.column_attrs}


def register_inventory_routes(app, get_db):
    """Call from main.py: register_inventory_routes(app, get_db)"""

    @router.get("/summary")
    def inventory_summary(db: Session = Depends(get_db)):
        lots = db.query(DbLotInventory).all()
        ocs = db.query(DbOffcutInventory).all()

        def lot_eff(l):
            return _norm_lot_status(l)

        def oc_eff(o):
            return _norm_offcut_status(o)

        total_lots = len(lots)
        active_lots = sum(1 for l in lots if lot_eff(l) in ("NEW", "IN_USE", "LOCKED") and (l.remaining_length_m or 0) > 0)
        locked_lots = sum(1 for l in lots if l.is_locked)
        depleted_lots = sum(
            1
            for l in lots
            if lot_eff(l) == "DEPLETED" or ((l.remaining_length_m or 0) <= 0 and lot_eff(l) not in LOT_TERMINAL)
        )
        total_offcuts = len(ocs)
        available_offcuts = sum(1 for o in ocs if oc_eff(o) in ("AVAILABLE", "PARTIALLY_USED") and (o.length_m or 0) > 0 and (o.width_m or 0) > 0)
        locked_offcuts = sum(1 for o in ocs if o.is_locked)
        cleared_offcuts = sum(1 for o in ocs if oc_eff(o) in ("CLEARED", "SCRAPPED", "LOST", "QUALITY_FAILED", "USED"))
        total_material_remaining_m = sum(l.remaining_length_m or 0 for l in lots if lot_eff(l) not in LOT_TERMINAL)
        total_offcut_area_m2 = sum(o.area_m2 or 0 for o in ocs if oc_eff(o) in ("AVAILABLE", "PARTIALLY_USED"))

        return {
            "total_lots": total_lots,
            "active_lots": active_lots,
            "locked_lots": locked_lots,
            "depleted_lots": depleted_lots,
            "total_offcuts": total_offcuts,
            "available_offcuts": available_offcuts,
            "locked_offcuts": locked_offcuts,
            "cleared_offcuts": cleared_offcuts,
            "total_material_remaining_m": round(total_material_remaining_m, 3),
            "total_offcut_area_m2": round(total_offcut_area_m2, 3),
        }

    @router.get("/material-codes")
    def inventory_material_codes(db: Session = Depends(get_db)):
        """Mã vật tư đang có trong kho (LOT + mảnh dư) và cấu hình ưu tiên vật tư."""
        codes = set()
        for (mc,) in db.query(DbLotInventory.material_code).distinct().all():
            s = (mc or "").strip()
            if s:
                codes.add(s)
        for (mc,) in db.query(DbOffcutInventory.material_code).distinct().all():
            s = (mc or "").strip()
            if s:
                codes.add(s)
        for (mc,) in db.query(DbMaterialPreference.preferred_material_code).distinct().all():
            s = (mc or "").strip()
            if s:
                codes.add(s)
        return sorted(codes)

    def _filter_lots(q, material_code, lot_status, is_locked, storage_location, qq):
        if material_code:
            q = q.filter(DbLotInventory.material_code == material_code)
        if storage_location:
            q = q.filter(DbLotInventory.storage_location.isnot(None)).filter(
                DbLotInventory.storage_location.like(f"%{storage_location}%")
            )
        if is_locked is not None:
            q = q.filter(DbLotInventory.is_locked == is_locked)
        rows = q.all()
        out = []
        for l in rows:
            eff = _norm_lot_status(l)
            if lot_status and eff != lot_status.upper():
                continue
            if qq:
                blob = f"{l.lot_id} {l.material_code} {l.storage_location or ''} {eff}".lower()
                if qq.lower() not in blob:
                    continue
            out.append(l)
        return out

    @router.get("/lots")
    def inventory_lots(
        db: Session = Depends(get_db),
        material_code: Optional[str] = None,
        lot_status: Optional[str] = None,
        is_locked: Optional[bool] = None,
        storage_location: Optional[str] = None,
        qq: Optional[str] = QueryParam(None, alias="q"),
    ):
        qry = db.query(DbLotInventory)
        return _filter_lots(qry, material_code, lot_status, is_locked, storage_location, qq)

    def _filter_offcuts(q, material_code, offcut_status, quality_status, is_locked, storage_location, qq):
        if material_code:
            q = q.filter(DbOffcutInventory.material_code == material_code)
        if quality_status:
            q = q.filter(DbOffcutInventory.quality_status == quality_status)
        if storage_location:
            q = q.filter(DbOffcutInventory.storage_location.isnot(None)).filter(
                DbOffcutInventory.storage_location.like(f"%{storage_location}%")
            )
        if is_locked is not None:
            q = q.filter(DbOffcutInventory.is_locked == is_locked)
        rows = q.all()
        out = []
        for o in rows:
            eff = _norm_offcut_status(o)
            if offcut_status and eff != offcut_status.upper():
                continue
            if qq:
                blob = f"{o.offcut_id} {o.material_code} {o.storage_location or ''} {eff}".lower()
                if qq.lower() not in blob:
                    continue
            out.append(o)
        return out

    @router.get("/offcuts")
    def inventory_offcuts(
        db: Session = Depends(get_db),
        material_code: Optional[str] = None,
        offcut_status: Optional[str] = None,
        quality_status: Optional[str] = None,
        is_locked: Optional[bool] = None,
        storage_location: Optional[str] = None,
        qq: Optional[str] = QueryParam(None, alias="q"),
    ):
        qry = db.query(DbOffcutInventory)
        rows = _filter_offcuts(qry, material_code, offcut_status, quality_status, is_locked, storage_location, qq)
        ids = [o.offcut_id for o in rows]
        meta = _first_import_actor_by_source(db, ids, ("IMPORT_OFFCUT_MANUAL", "IMPORT_OFFCUT_WORKSTREAM"))
        out = []
        for o in rows:
            d = _orm_columns_dict(o)
            m = meta.get(o.offcut_id) or {}
            d["import_performed_by"] = m.get("import_performed_by") or ""
            d["import_performed_at"] = m.get("import_performed_at") or ""
            out.append(d)
        return out

    @router.get("/locked-catalog")
    def inventory_locked_catalog(db: Session = Depends(get_db)):
        """LOT & mảnh dư đang khóa — dữ liệu dạng dict + người nhập từ bút toán IMPORT_* đầu tiên."""
        lots = _filter_lots(db.query(DbLotInventory), None, None, True, None, None)
        ocs = _filter_offcuts(db.query(DbOffcutInventory), None, None, None, True, None, None)
        lot_meta = _first_import_actor_by_source(db, [l.lot_id for l in lots], ("IMPORT_LOT",))
        oc_meta = _first_import_actor_by_source(db, [o.offcut_id for o in ocs], ("IMPORT_OFFCUT_MANUAL", "IMPORT_OFFCUT_WORKSTREAM"))

        def lot_row(l):
            m = lot_meta.get(l.lot_id) or {}
            return {
                "lot_id": l.lot_id,
                "material_code": l.material_code or "",
                "material_name": (l.material_name or "").strip(),
                "film_type": (l.film_type or "").strip(),
                "effective_status": _norm_lot_status(l),
                "remaining_length_m": l.remaining_length_m,
                "original_width_m": l.original_width_m,
                "original_length_m": l.original_length_m,
                "storage_location": (l.storage_location or "").strip(),
                "locked_by_request_id": (l.locked_by_request_id or "").strip(),
                "locked_by_workstream_id": (l.locked_by_workstream_id or "").strip(),
                "import_date": (l.import_date or "").strip(),
                "import_performed_by": m.get("import_performed_by") or "",
                "import_performed_at": m.get("import_performed_at") or "",
            }

        def oc_row(o):
            m = oc_meta.get(o.offcut_id) or {}
            return {
                "offcut_id": o.offcut_id,
                "material_code": o.material_code or "",
                "material_name": (o.material_name or "").strip(),
                "film_type": (o.film_type or "").strip(),
                "effective_status": _norm_offcut_status(o),
                "width_m": o.width_m,
                "length_m": o.length_m,
                "area_m2": o.area_m2,
                "quality_status": (o.quality_status or "").strip(),
                "storage_location": (o.storage_location or "").strip(),
                "parent_lot_id": (o.parent_lot_id or "").strip(),
                "locked_by_request_id": (o.locked_by_request_id or "").strip(),
                "locked_by_workstream_id": (o.locked_by_workstream_id or "").strip(),
                "import_date": (o.import_date or "").strip(),
                "import_performed_by": m.get("import_performed_by") or "",
                "import_performed_at": m.get("import_performed_at") or "",
                "created_from_request_id": (o.created_from_request_id or "").strip(),
            }

        return {"lots": [lot_row(l) for l in lots], "offcuts": [oc_row(o) for o in ocs]}

    @router.post("/lots/import")
    def import_lot(data: dict, db: Session = Depends(get_db)):
        lot_id = (data.get("lot_id") or "").strip()
        material_code = (data.get("material_code") or "").strip()
        width_m = float(data.get("width_m") or 0)
        original_length_m = float(data.get("original_length_m") or 0)
        remaining_length_m = float(data.get("remaining_length_m") if data.get("remaining_length_m") is not None else original_length_m)
        storage_location = (data.get("storage_location") or "").strip()
        performed_by = (data.get("performed_by") or "AD-001").strip()

        if not lot_id:
            raise HTTPException(400, "lot_id bắt buộc")
        if db.query(DbLotInventory).filter(DbLotInventory.lot_id == lot_id).first():
            raise HTTPException(400, "lot_id đã tồn tại")
        if not material_code:
            raise HTTPException(400, "material_code bắt buộc")
        if width_m <= 0:
            raise HTTPException(400, "width_m phải > 0")
        if original_length_m <= 0:
            raise HTTPException(400, "original_length_m phải > 0")
        if remaining_length_m > original_length_m + 1e-9:
            raise HTTPException(400, "remaining_length_m không được lớn hơn original_length_m")
        if remaining_length_m < -1e-9:
            raise HTTPException(400, "remaining_length_m không được âm")
        if not storage_location:
            raise HTTPException(400, "storage_location bắt buộc")

        lot = DbLotInventory(
            lot_id=lot_id,
            material_code=material_code,
            material_name=data.get("material_name"),
            film_type=data.get("film_type") or "OTHER",
            manufacturer=data.get("manufacturer"),
            supplier=data.get("supplier"),
            invoice_no=data.get("invoice_no"),
            original_width_m=width_m,
            original_length_m=original_length_m,
            remaining_length_m=remaining_length_m,
            storage_location=storage_location,
            is_opened=False,
            is_locked=False,
            lot_status="NEW",
            import_date=datetime.date.today().isoformat(),
            status="ACTIVE",
            note=data.get("note"),
        )
        db.add(lot)
        _add_inv_txn(
            db,
            transaction_type="IMPORT_LOT",
            source_type="LOT",
            source_id=lot_id,
            material_code=material_code,
            material_name=lot.material_name,
            width_m=width_m,
            length_m=original_length_m,
            area_m2=None,
            quantity_m=remaining_length_m,
            balance_unit="METER",
            before_balance=0.0,
            after_balance=remaining_length_m,
            before_status=None,
            after_status="NEW",
            reason=data.get("note"),
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=None,
            parent_offcut_id=None,
            performed_by=performed_by,
            performed_role="ADMIN",
            note=data.get("note"),
        )
        _audit_inv(
            db,
            event_type="LOT_IMPORTED",
            source_type="LOT",
            source_id=lot_id,
            before_value="None",
            after_value=f"{remaining_length_m}m @ {lot_id}",
            reason=data.get("note") or "IMPORT_LOT",
            actor=performed_by,
        )
        db.commit()
        db.refresh(lot)
        return {"status": "success", "lot": lot}

    @router.post("/offcuts/import")
    def import_offcut_manual(data: dict, db: Session = Depends(get_db)):
        offcut_id = (data.get("offcut_id") or "").strip()
        parent_lot_id = (data.get("parent_lot_id") or "").strip() or None
        material_code = (data.get("material_code") or "").strip()
        width_m = float(data.get("width_m") or 0)
        length_m = float(data.get("length_m") or 0)
        storage_location = (data.get("storage_location") or "").strip()
        quality_status = (data.get("quality_status") or "GOOD").strip()
        performed_by = (data.get("performed_by") or "AD-001").strip()
        created_reason = (data.get("created_reason") or "").strip()

        if not offcut_id:
            raise HTTPException(400, "offcut_id bắt buộc")
        if db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == offcut_id).first():
            raise HTTPException(400, "offcut_id đã tồn tại")
        if not material_code:
            raise HTTPException(400, "material_code bắt buộc")
        if width_m <= 0 or length_m <= 0:
            raise HTTPException(400, "width_m và length_m phải > 0")
        if not quality_status:
            raise HTTPException(400, "quality_status bắt buộc")
        if not storage_location:
            raise HTTPException(400, "storage_location bắt buộc")
        if not parent_lot_id and not created_reason:
            raise HTTPException(400, "Thiếu parent_lot_id — bắt buộc nhập created_reason")

        area_m2 = round(width_m * length_m, 3)
        if data.get("area_m2") is not None:
            client_a = float(data["area_m2"])
            if abs(client_a - area_m2) > 0.01:
                raise HTTPException(400, "area_m2 không khớp width_m * length_m")

        oc = DbOffcutInventory(
            offcut_id=offcut_id,
            parent_lot_id=parent_lot_id,
            material_code=material_code,
            material_name=data.get("material_name"),
            film_type=data.get("film_type") or "WINDOW_FILM",
            width_m=width_m,
            length_m=length_m,
            area_m2=area_m2,
            quality_status=quality_status,
            offcut_status="AVAILABLE",
            is_locked=False,
            storage_location=storage_location,
            created_reason=created_reason or None,
            import_date=datetime.date.today().isoformat(),
            status="ACTIVE",
            note=data.get("note"),
        )
        db.add(oc)
        _add_inv_txn(
            db,
            transaction_type="IMPORT_OFFCUT_MANUAL",
            source_type="OFFCUT",
            source_id=offcut_id,
            material_code=material_code,
            material_name=oc.material_name,
            width_m=width_m,
            length_m=length_m,
            area_m2=area_m2,
            quantity_m=area_m2,
            balance_unit="SQUARE_METER",
            before_balance=0.0,
            after_balance=area_m2,
            before_status=None,
            after_status="AVAILABLE",
            reason=created_reason or data.get("note"),
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=parent_lot_id,
            parent_offcut_id=None,
            performed_by=performed_by,
            performed_role="ADMIN",
            note=data.get("note"),
        )
        _audit_inv(
            db,
            event_type="OFFCUT_IMPORTED_MANUAL",
            source_type="OFFCUT",
            source_id=offcut_id,
            before_value="None",
            after_value=f"{area_m2}m²",
            reason=created_reason or data.get("note") or "IMPORT_OFFCUT_MANUAL",
            actor=performed_by,
        )
        db.commit()
        db.refresh(oc)
        return {"status": "success", "offcut": oc}

    @router.post("/lots/{lot_id}/manual-issue")
    def manual_issue_lot(lot_id: str, data: dict, db: Session = Depends(get_db)):
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lot_id).first()
        if not lot:
            raise HTTPException(404, "LOT không tồn tại")
        ls = _norm_lot_status(lot)
        rem0 = lot.remaining_length_m or 0
        if ls in LOT_MANUAL_ISSUE_BLOCKED or rem0 <= 1e-9:
            raise HTTPException(400, f"LOT không xuất thủ công được (trạng thái {ls}, tồn {rem0}m).")
        issue_len = float(data.get("issue_length_m") or 0)
        reason = (data.get("reason") or "").strip()
        performed_by = (data.get("performed_by") or "QL-002").strip()
        admin_override = bool(data.get("admin_override"))
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        if issue_len <= 0:
            raise HTTPException(400, "issue_length_m phải > 0")
        rem = lot.remaining_length_m or 0
        if issue_len > rem + 1e-9:
            raise HTTPException(400, "Không cho xuất quá tồn")
        if lot.is_locked and not admin_override:
            raise HTTPException(400, "LOT đang khóa — không xuất thủ công (dùng admin_override hoặc release lock).")

        before = rem
        after = round(max(0.0, rem - issue_len), 3)
        lot.remaining_length_m = after
        lot.is_opened = True
        if after <= 1e-9:
            lot.lot_status = "DEPLETED"
        elif lot.lot_status in (None, "NEW", "ACTIVE"):
            lot.lot_status = "IN_USE"

        note = data.get("note")
        if admin_override:
            reason = f"[ADMIN_OVERRIDE] {reason}"

        _add_inv_txn(
            db,
            transaction_type="MANUAL_ISSUE_LOT",
            source_type="LOT",
            source_id=lot_id,
            material_code=lot.material_code,
            material_name=lot.material_name,
            width_m=lot.original_width_m,
            length_m=issue_len,
            area_m2=None,
            quantity_m=issue_len,
            balance_unit="METER",
            before_balance=before,
            after_balance=after,
            before_status=ls,
            after_status=_norm_lot_status(lot),
            reason=reason,
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=None,
            parent_offcut_id=None,
            performed_by=performed_by,
            performed_role="MANAGER",
            note=note,
        )
        _audit_inv(
            db,
            event_type="LOT_MANUAL_ISSUED",
            source_type="LOT",
            source_id=lot_id,
            before_value=f"{before}m",
            after_value=f"{after}m",
            reason=reason,
            actor=performed_by,
        )
        db.commit()
        return {"status": "success", "remaining_length_m": after, "lot_status": lot.lot_status}

    @router.post("/offcuts/{offcut_id}/manual-issue")
    def manual_issue_offcut(offcut_id: str, data: dict, db: Session = Depends(get_db)):
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == offcut_id).first()
        if not oc:
            raise HTTPException(404, "OFFCUT không tồn tại")
        eff = _norm_offcut_status(oc)
        if eff not in OFFCUT_ISSUEABLE:
            raise HTTPException(400, f"OFFCUT trạng thái {eff}, không xuất thủ công.")
        issue_w = float(data.get("issue_width_m") or 0)
        issue_l = float(data.get("issue_length_m") or 0)
        reason = (data.get("reason") or "").strip()
        performed_by = (data.get("performed_by") or "QL-002").strip()
        admin_override = bool(data.get("admin_override"))
        mark_avail = bool(data.get("mark_remaining_as_available"))
        clear_scrap = bool(data.get("clear_remaining_as_scrap"))
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        if issue_w <= 0 or issue_l <= 0:
            raise HTTPException(400, "issue_width_m và issue_length_m phải > 0")
        if issue_w > (oc.width_m or 0) + 1e-6 or issue_l > (oc.length_m or 0) + 1e-6:
            raise HTTPException(400, "Không cho xuất quá kích thước mảnh dư")
        if oc.is_locked and not admin_override:
            raise HTTPException(400, "Mảnh dư đang khóa — không xuất (admin_override hoặc release lock).")
        if admin_override:
            reason = f"[ADMIN_OVERRIDE] {reason}"

        w0, l0 = oc.width_m or 0, oc.length_m or 0
        a0 = oc.area_m2 or round(w0 * l0, 3)
        eps = 0.002

        def consume_full():
            oc.width_m = 0.0
            oc.length_m = 0.0
            oc.area_m2 = 0.0
            oc.offcut_status = "CLEARED"

        issued_area = round(issue_w * issue_l, 3)

        if abs(issue_w - w0) < eps and abs(issue_l - l0) < eps:
            consume_full()
            new_status = "CLEARED"
        elif abs(issue_w - w0) < eps:
            new_len = round(l0 - issue_l, 3)
            if new_len < -eps:
                raise HTTPException(400, "Lỗi tính toán chiều dài")
            if new_len <= eps:
                consume_full()
            else:
                oc.length_m = new_len
                oc.area_m2 = round(w0 * new_len, 3)
                oc.offcut_status = "PARTIALLY_USED" if mark_avail else "PARTIALLY_USED"
            new_status = _norm_offcut_status(oc)
        elif abs(issue_l - l0) < eps:
            new_w = round(w0 - issue_w, 3)
            if new_w <= eps:
                consume_full()
            else:
                oc.width_m = new_w
                oc.area_m2 = round(new_w * l0, 3)
                oc.offcut_status = "PARTIALLY_USED"
            new_status = _norm_offcut_status(oc)
        else:
            raise HTTPException(
                400,
                "MVP: xuất một phần chỉ khi trùng full chiều rộng hoặc full chiều dài của mảnh dư.",
            )

        _add_inv_txn(
            db,
            transaction_type="MANUAL_ISSUE_OFFCUT",
            source_type="OFFCUT",
            source_id=offcut_id,
            material_code=oc.material_code,
            material_name=oc.material_name,
            width_m=issue_w,
            length_m=issue_l,
            area_m2=issued_area,
            quantity_m=issued_area,
            balance_unit="SQUARE_METER",
            before_balance=a0,
            after_balance=oc.area_m2 or 0.0,
            before_status=eff,
            after_status=_norm_offcut_status(oc),
            reason=reason,
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=oc.parent_lot_id,
            parent_offcut_id=oc.parent_offcut_id,
            performed_by=performed_by,
            performed_role="MANAGER",
            note=data.get("note"),
        )

        if clear_scrap and (oc.width_m or 0) > eps and (oc.length_m or 0) > eps:
            scrap_a = oc.area_m2 or 0
            _add_inv_txn(
                db,
                transaction_type="RECORD_SCRAP",
                source_type="OFFCUT",
                source_id=offcut_id,
                material_code=oc.material_code,
                material_name=oc.material_name,
                width_m=oc.width_m,
                length_m=oc.length_m,
                area_m2=scrap_a,
                quantity_m=scrap_a,
                balance_unit="SQUARE_METER",
                before_balance=scrap_a,
                after_balance=0.0,
                before_status=_norm_offcut_status(oc),
                after_status="SCRAPPED",
                reason=reason + " | remainder scrap",
                related_request_id=None,
                related_workstream_id=None,
                related_job_card_id=None,
                parent_lot_id=oc.parent_lot_id,
                parent_offcut_id=None,
                performed_by=performed_by,
                performed_role="MANAGER",
                note="clear_remaining_as_scrap",
            )
            _audit_inv(
                db,
                event_type="RECORD_SCRAP",
                source_type="OFFCUT",
                source_id=offcut_id,
                before_value=f"{scrap_a}m²",
                after_value="0",
                reason=reason,
                actor=performed_by,
            )
            oc.width_m = 0.0
            oc.length_m = 0.0
            oc.area_m2 = 0.0
            oc.offcut_status = "SCRAPPED"

        _audit_inv(
            db,
            event_type="OFFCUT_MANUAL_ISSUED",
            source_type="OFFCUT",
            source_id=offcut_id,
            before_value=f"{a0}m² ({w0}x{l0}m)",
            after_value=f"{oc.area_m2 or 0}m² status={_norm_offcut_status(oc)}",
            reason=reason,
            actor=performed_by,
        )
        db.commit()
        return {"status": "success", "offcut": oc}

    CLEAR_LOT_MODE = {
        "WRITE_OFF_TO_ZERO": "CLEARED",
        "MARK_AS_SCRAPPED": "SCRAPPED",
        "CLOSE_DEPLETED": "CLOSED",
        "LOST_IN_STOCKTAKE": "CLEARED",
    }

    @router.post("/lots/{lot_id}/clear")
    def clear_lot(lot_id: str, data: dict, db: Session = Depends(get_db)):
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lot_id).first()
        if not lot:
            raise HTTPException(404, "LOT không tồn tại")
        reason = (data.get("reason") or "").strip()
        performed_by = (data.get("performed_by") or "QL-002").strip()
        admin_override = bool(data.get("admin_override"))
        mode = (data.get("clear_mode") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        if mode not in CLEAR_LOT_MODE:
            raise HTTPException(400, "clear_mode không hợp lệ")
        ls = _norm_lot_status(lot)
        if ls in LOT_TERMINAL and not admin_override:
            raise HTTPException(400, "LOT đã terminal — không clear (admin_override).")
        if lot.is_locked and not admin_override:
            raise HTTPException(400, "LOT đang khóa — không clear (admin_override).")
        if admin_override:
            reason = f"[ADMIN_OVERRIDE] {reason}"

        before = lot.remaining_length_m or 0
        lot.remaining_length_m = 0.0
        new_st = CLEAR_LOT_MODE[mode]
        lot.lot_status = new_st

        _add_inv_txn(
            db,
            transaction_type="CLEAR_LOT",
            source_type="LOT",
            source_id=lot_id,
            material_code=lot.material_code,
            material_name=lot.material_name,
            width_m=lot.original_width_m,
            length_m=before,
            area_m2=None,
            quantity_m=before,
            balance_unit="METER",
            before_balance=before,
            after_balance=0.0,
            before_status=ls,
            after_status=new_st,
            reason=reason,
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=None,
            parent_offcut_id=None,
            performed_by=performed_by,
            performed_role="MANAGER",
            note=data.get("note"),
        )
        _audit_inv(
            db,
            event_type="LOT_CLEARED",
            source_type="LOT",
            source_id=lot_id,
            before_value=f"{before}m",
            after_value=f"0m | {new_st}",
            reason=reason,
            actor=performed_by,
        )
        db.commit()
        return {"status": "success", "lot_status": new_st}

    CLEAR_OFFCUT_MODE = {
        "QUALITY_FAILED": "QUALITY_FAILED",
        "WRITE_OFF_TO_ZERO": "CLEARED",
        "MARK_AS_SCRAPPED": "SCRAPPED",
        "LOST_IN_STOCKTAKE": "LOST",
        "TOO_SMALL_TO_USE": "SCRAPPED",
    }

    @router.post("/offcuts/{offcut_id}/clear")
    def clear_offcut(offcut_id: str, data: dict, db: Session = Depends(get_db)):
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == offcut_id).first()
        if not oc:
            raise HTTPException(404, "OFFCUT không tồn tại")
        reason = (data.get("reason") or "").strip()
        performed_by = (data.get("performed_by") or "QL-002").strip()
        admin_override = bool(data.get("admin_override"))
        mode = (data.get("clear_mode") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        if mode not in CLEAR_OFFCUT_MODE:
            raise HTTPException(400, "clear_mode không hợp lệ")
        eff = _norm_offcut_status(oc)
        if eff in OFFCUT_TERMINAL and not admin_override:
            raise HTTPException(400, "Mảnh dư đã terminal — không clear (admin_override).")
        if oc.is_locked and not admin_override:
            raise HTTPException(400, "Đang khóa — không clear (admin_override).")
        if admin_override:
            reason = f"[ADMIN_OVERRIDE] {reason}"

        before_a = oc.area_m2 or round((oc.width_m or 0) * (oc.length_m or 0), 3)
        new_st = CLEAR_OFFCUT_MODE[mode]
        oc.offcut_status = new_st
        oc.width_m = 0.0
        oc.length_m = 0.0
        oc.area_m2 = 0.0

        _add_inv_txn(
            db,
            transaction_type="CLEAR_OFFCUT",
            source_type="OFFCUT",
            source_id=offcut_id,
            material_code=oc.material_code,
            material_name=oc.material_name,
            width_m=0,
            length_m=0,
            area_m2=0,
            quantity_m=before_a,
            balance_unit="SQUARE_METER",
            before_balance=before_a,
            after_balance=0.0,
            before_status=eff,
            after_status=new_st,
            reason=reason,
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=oc.parent_lot_id,
            parent_offcut_id=oc.parent_offcut_id,
            performed_by=performed_by,
            performed_role="MANAGER",
            note=data.get("note"),
        )
        _audit_inv(
            db,
            event_type="OFFCUT_CLEARED",
            source_type="OFFCUT",
            source_id=offcut_id,
            before_value=f"{before_a}m²",
            after_value=f"0m² | {new_st}",
            reason=reason,
            actor=performed_by,
        )
        db.commit()
        return {"status": "success", "offcut_status": new_st}

    @router.post("/locks/release")
    def release_lock_manual(data: dict, db: Session = Depends(get_db)):
        source_type = (data.get("source_type") or "").upper()
        source_id = (data.get("source_id") or "").strip()
        reason = (data.get("reason") or "").strip()
        performed_by = (data.get("performed_by") or "QL-002").strip()
        related_request_id = (data.get("related_request_id") or "").strip() or None
        if source_type not in ("LOT", "OFFCUT"):
            raise HTTPException(400, "source_type phải LOT hoặc OFFCUT")
        if not source_id:
            raise HTTPException(400, "source_id bắt buộc")
        if not reason:
            raise HTTPException(400, "reason bắt buộc")

        if source_type == "LOT":
            ent = db.query(DbLotInventory).filter(DbLotInventory.lot_id == source_id).first()
            if not ent:
                raise HTTPException(404, "LOT không tồn tại")
            if not ent.is_locked:
                raise HTTPException(400, "LOT không đang khóa")
            before = f"locked=true rid={ent.locked_by_request_id} ws={ent.locked_by_workstream_id}"
            ent.is_locked = False
            ent.locked_by_request_id = None
            ent.locked_by_workstream_id = None
            if (ent.lot_status or "").upper() == "LOCKED":
                ent.lot_status = "IN_USE" if (ent.remaining_length_m or 0) > 0 else "DEPLETED"
        else:
            ent = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == source_id).first()
            if not ent:
                raise HTTPException(404, "OFFCUT không tồn tại")
            if not ent.is_locked:
                raise HTTPException(400, "OFFCUT không đang khóa")
            before = f"locked=true rid={ent.locked_by_request_id} ws={ent.locked_by_workstream_id}"
            ent.is_locked = False
            ent.locked_by_request_id = None
            ent.locked_by_workstream_id = None

        _add_inv_txn(
            db,
            transaction_type="RELEASE_LOCK_MANUAL",
            source_type=source_type,
            source_id=source_id,
            material_code=getattr(ent, "material_code", "") or "",
            material_name=getattr(ent, "material_name", None),
            width_m=getattr(ent, "original_width_m", None) or getattr(ent, "width_m", None),
            length_m=getattr(ent, "remaining_length_m", None) or getattr(ent, "length_m", None),
            area_m2=getattr(ent, "area_m2", None),
            quantity_m=None,
            balance_unit="METER" if source_type == "LOT" else "SQUARE_METER",
            before_balance=None,
            after_balance=None,
            before_status=before,
            after_status="is_locked=false",
            reason=reason,
            related_request_id=related_request_id,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=getattr(ent, "parent_lot_id", None),
            parent_offcut_id=getattr(ent, "parent_offcut_id", None),
            performed_by=performed_by,
            performed_role="MANAGER",
            note=None,
        )
        _audit_inv(
            db,
            event_type="SOFT_LOCK_RELEASED_MANUAL",
            source_type=source_type,
            source_id=source_id,
            before_value=before,
            after_value="is_locked=false",
            reason=reason,
            actor=performed_by,
            request_id=related_request_id,
        )
        db.commit()
        return {"status": "success"}

    @router.get("/transactions")
    def list_inv_transactions(
        db: Session = Depends(get_db),
        transaction_type: Optional[str] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        material_code: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        related_request_id: Optional[str] = None,
    ):
        q = db.query(DbInventoryTransaction).order_by(DbInventoryTransaction.id.desc())
        if transaction_type:
            q = q.filter(DbInventoryTransaction.transaction_type == transaction_type)
        if source_type:
            q = q.filter(DbInventoryTransaction.source_type == source_type)
        if source_id:
            q = q.filter(DbInventoryTransaction.source_id == source_id)
        if material_code:
            q = q.filter(DbInventoryTransaction.material_code == material_code)
        if related_request_id:
            q = q.filter(DbInventoryTransaction.related_request_id == related_request_id)
        rows = q.limit(500).all()
        out = []
        for t in rows:
            if date_from and (t.performed_at or "") < date_from:
                continue
            if date_to and (t.performed_at or "") > date_to + "T23:59:59":
                continue
            out.append(t)
        return out

    @router.get("/lots/active-options")
    def lots_active_options(
        db: Session = Depends(get_db),
        material_code: str = QueryParam(..., description="Mã vật tư (JB20, T-TYPE, …)"),
        min_length_m: float = QueryParam(0.0),
        min_width_m: float = QueryParam(0.0),
        request_id: Optional[str] = QueryParam(None),
        workstream_id: Optional[str] = QueryParam(None),
        workstream_type: Optional[str] = QueryParam(None),
    ):
        """LOT dùng cho allocation — loại terminal / hết tồn / lock request khác."""
        _ = (workstream_id, workstream_type)
        rows = db.query(DbLotInventory).filter(DbLotInventory.material_code == material_code).all()
        out = []
        for l in rows:
            if l.lot_id in LOT_DEMO_IDS_HIDE_FROM_ACTIVE_OPTIONS:
                continue
            eff = _norm_lot_status(l)
            if eff in LOT_TERMINAL or eff == "DEPLETED":
                continue
            if eff not in ("NEW", "IN_USE"):
                continue
            rem = float(l.remaining_length_m or 0)
            if rem <= 1e-9:
                continue
            if min_length_m > 0 and rem + 1e-9 < min_length_m:
                continue
            wm = float(l.original_width_m or 0)
            if min_width_m > 0 and wm > 0 and wm + 1e-9 < min_width_m:
                continue
            lr = (l.locked_by_request_id or "").strip()
            if l.is_locked and lr and request_id and lr != request_id:
                continue
            loc = l.storage_location or "—"
            out.append(
                {
                    "source_type": "LOT",
                    "source_id": l.lot_id,
                    "material_code": l.material_code,
                    "remaining_length_m": round(rem, 3),
                    "width_m": wm,
                    "storage_location": l.storage_location,
                    "status": eff,
                    "is_locked": bool(l.is_locked),
                    "display_name": f"{l.lot_id} — còn {rem:.2f}m — {loc}",
                }
            )
        return {"items": out, "count": len(out)}

    @router.get("/offcuts/active-options")
    def offcuts_active_options(
        db: Session = Depends(get_db),
        material_code: str = QueryParam(...),
        min_length_m: float = QueryParam(0.0),
        min_width_m: float = QueryParam(0.0),
        request_id: Optional[str] = QueryParam(None),
        workstream_id: Optional[str] = QueryParam(None),
        workstream_type: Optional[str] = QueryParam(None),
    ):
        _ = (workstream_id, workstream_type)
        rows = db.query(DbOffcutInventory).filter(DbOffcutInventory.material_code == material_code).all()
        out = []
        for o in rows:
            eff = _norm_offcut_status(o)
            if eff in OFFCUT_TERMINAL:
                continue
            if eff not in OFFCUT_ISSUEABLE:
                continue
            ql = (o.quality_status or "NORMAL").upper()
            if ql == "POOR":
                continue
            olen = float(o.length_m or 0)
            ow = float(o.width_m or 0)
            if olen <= 1e-9 or ow <= 1e-9:
                continue
            if min_length_m > 0 and olen + 1e-9 < min_length_m:
                continue
            if min_width_m > 0 and ow + 1e-9 < min_width_m:
                continue
            lr = (o.locked_by_request_id or "").strip()
            if o.is_locked and lr and request_id and lr != request_id:
                continue
            loc = o.storage_location or "—"
            area = round((o.area_m2 or ow * olen), 3)
            out.append(
                {
                    "source_type": "OFFCUT",
                    "source_id": o.offcut_id,
                    "material_code": o.material_code,
                    "width_m": ow,
                    "length_m": olen,
                    "area_m2": area,
                    "quality_status": o.quality_status or "NORMAL",
                    "storage_location": o.storage_location,
                    "status": eff,
                    "is_locked": bool(o.is_locked),
                    "display_name": f"{o.offcut_id} — {ow:.2f} x {olen:.2f}m — {ql} — {loc}",
                }
            )
        return {"items": out, "count": len(out)}

    @router.get("/validate-sources/{request_id}")
    def validate_sources_for_request(request_id: str, db: Session = Depends(get_db)):
        issues = []
        wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
        for ws in wss:
            if ws.status == "CLOSED" or ws.inventory_committed:
                continue
            sid = ws.allocated_source_id
            st = (ws.allocated_source_type or "LOT").upper()
            if not sid:
                continue
            if st == "LOT":
                lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
                if not lot:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": "LOT không tồn tại trên kho.",
                        }
                    )
                    continue
                ls = _norm_lot_status(lot)
                rem = lot.remaining_length_m or 0
                if ls in LOT_TERMINAL:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": f"LOT đã {ls} (CLEARED/SCRAPPED/CLOSED) — không còn hợp lệ cho thi công.",
                        }
                    )
                    continue
                if ls == "DEPLETED" or rem <= 1e-9:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": "LOT đã DEPLETED / hết tồn — không còn hợp lệ cho thi công.",
                        }
                    )
                    continue
                need = float(ws.planned_deduction_length_m or 0)
                if rem < need - 1e-6:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": f"Tồn LOT không đủ ({rem}m < {need}m).",
                        }
                    )
                lock_rid = (lot.locked_by_request_id or "").strip()
                if lot.is_locked and lock_rid and lock_rid != request_id:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "WARNING",
                            "message": f"LOT đang soft lock bởi request khác ({lock_rid}).",
                        }
                    )
                elif lot.is_locked and not lock_rid:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "LOT",
                            "source_id": sid,
                            "severity": "WARNING",
                            "message": "LOT đang soft lock (chưa gắn request_id) — kiểm tra trước khi thi công.",
                        }
                    )
            elif st == "OFFCUT":
                oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
                if not oc:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "OFFCUT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": "Mảnh dư không tồn tại.",
                        }
                    )
                    continue
                eff = _norm_offcut_status(oc)
                if eff in OFFCUT_TERMINAL:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "OFFCUT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": f"Mảnh dư đã {eff} (CLEARED/SCRAPPED/LOST/QUALITY_FAILED/USED) — không còn hợp lệ.",
                        }
                    )
                    continue
                if eff not in OFFCUT_ISSUEABLE or (oc.length_m or 0) <= 0 or (oc.width_m or 0) <= 0:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "OFFCUT",
                            "source_id": sid,
                            "severity": "ERROR",
                            "message": f"Mảnh dư không khả dụng ({eff}) hoặc kích thước không hợp lệ.",
                        }
                    )
                lock_rid = (oc.locked_by_request_id or "").strip()
                if oc.is_locked and lock_rid and lock_rid != request_id:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "OFFCUT",
                            "source_id": sid,
                            "severity": "WARNING",
                            "message": f"Mảnh dư đang soft lock bởi request khác ({lock_rid}).",
                        }
                    )
                elif oc.is_locked and not lock_rid:
                    issues.append(
                        {
                            "workstream_id": ws.workstream_id,
                            "source_type": "OFFCUT",
                            "source_id": sid,
                            "severity": "WARNING",
                            "message": "Mảnh dư đang soft lock — kiểm tra trước khi thi công.",
                        }
                    )
        return {"request_id": request_id, "issues": issues}

    app.include_router(router)
