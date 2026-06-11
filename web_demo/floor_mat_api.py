# -*- coding: utf-8 -*-
"""Kho thảm trải sàn — CRUD SKU + nhật ký giao dịch."""
import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Query as QP
from sqlalchemy.orm import Session

from database import DbFloorMatInventory, DbFloorMatTransaction, SessionLocal


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter(prefix="/api/floor-mats", tags=["floor-mats"])


def _now_iso():
    return datetime.datetime.utcnow().isoformat() + "Z"


def _uid():
    return uuid.uuid4().hex[:10].upper()


def _fm_dict(row: DbFloorMatInventory) -> dict:
    return {
        "sku": row.sku,
        "name": row.name,
        "unit": row.unit or "bộ",
        "qty_total": row.qty_total or 0,
        "qty_reserved": row.qty_reserved or 0,
        "qty_available": max(0, (row.qty_total or 0) - (row.qty_reserved or 0)),
        "min_stock": row.min_stock or 0,
        "supplier": row.supplier or "",
        "note": row.note or "",
        "created_at": row.created_at or "",
        "low_stock": (row.qty_total or 0) - (row.qty_reserved or 0) <= (row.min_stock or 0),
    }


@router.get("")
def list_floor_mats(db: Session = Depends(get_db)):
    rows = db.query(DbFloorMatInventory).order_by(DbFloorMatInventory.sku).all()
    return [_fm_dict(r) for r in rows]


@router.post("")
def create_floor_mat(data: dict, db: Session = Depends(get_db)):
    sku = (data.get("sku") or "").strip().upper()
    name = (data.get("name") or "").strip()
    if not sku:
        raise HTTPException(400, "sku bắt buộc")
    if not name:
        raise HTTPException(400, "name bắt buộc")
    if db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first():
        raise HTTPException(400, f"SKU {sku} đã tồn tại")
    row = DbFloorMatInventory(
        sku=sku,
        name=name,
        unit=data.get("unit") or "bộ",
        qty_total=int(data.get("qty_total") or 0),
        qty_reserved=0,
        min_stock=int(data.get("min_stock") or 5),
        supplier=data.get("supplier") or None,
        note=data.get("note") or None,
        created_at=_now_iso(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _fm_dict(row)


@router.put("/{sku}")
def update_floor_mat(sku: str, data: dict, db: Session = Depends(get_db)):
    row = db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first()
    if not row:
        raise HTTPException(404, f"SKU {sku} không tồn tại")
    if "name" in data and data["name"]:
        row.name = str(data["name"]).strip()
    if "unit" in data:
        row.unit = data["unit"] or "bộ"
    if "min_stock" in data and data["min_stock"] is not None:
        row.min_stock = int(data["min_stock"])
    if "supplier" in data:
        row.supplier = data["supplier"] or None
    if "note" in data:
        row.note = data["note"] or None
    db.commit()
    db.refresh(row)
    return _fm_dict(row)


@router.post("/{sku}/import")
def import_floor_mat(sku: str, data: dict, db: Session = Depends(get_db)):
    """Nhập kho: tăng qty_total, ghi transaction IMPORT."""
    row = db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first()
    if not row:
        raise HTTPException(404, f"SKU {sku} không tồn tại")
    qty = int(data.get("quantity") or 0)
    if qty <= 0:
        raise HTTPException(400, "quantity phải > 0")
    performed_by = (data.get("performed_by") or "ADMIN").strip()
    note = (data.get("note") or f"Nhập kho {qty} {row.unit}").strip()

    row.qty_total = (row.qty_total or 0) + qty
    tx = DbFloorMatTransaction(
        tx_id=f"FMT-{_uid()}",
        sku=sku,
        tx_type="IMPORT",
        quantity=qty,
        performed_by=performed_by,
        note=note,
        created_at=_now_iso(),
    )
    db.add(tx)
    db.commit()
    db.refresh(row)
    return {"status": "success", "sku": sku, "qty_total": row.qty_total, "qty_available": max(0, (row.qty_total or 0) - (row.qty_reserved or 0))}


@router.get("/transactions")
def list_floor_mat_transactions(
    db: Session = Depends(get_db),
    sku: Optional[str] = QP(None),
    request_id: Optional[str] = QP(None),
    tx_type: Optional[str] = QP(None),
    limit: int = QP(100, ge=1, le=500),
):
    q = db.query(DbFloorMatTransaction)
    if sku:
        q = q.filter(DbFloorMatTransaction.sku == sku)
    if request_id:
        q = q.filter(DbFloorMatTransaction.request_id == request_id)
    if tx_type:
        q = q.filter(DbFloorMatTransaction.tx_type == tx_type.upper())
    rows = q.order_by(DbFloorMatTransaction.created_at.desc()).limit(limit).all()
    return [
        {
            "tx_id": r.tx_id,
            "sku": r.sku,
            "request_id": r.request_id or "",
            "workstream_id": r.workstream_id or "",
            "tx_type": r.tx_type,
            "quantity": r.quantity,
            "performed_by": r.performed_by or "",
            "note": r.note or "",
            "created_at": r.created_at or "",
        }
        for r in rows
    ]
