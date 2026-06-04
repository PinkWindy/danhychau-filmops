# -*- coding: utf-8 -*-
"""Customer / dealer / vehicle management + manual request creation."""
import datetime
import json
import uuid
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import (
    DbDealer,
    DbCustomer,
    DbVehicleProfile,
    DbRequest,
    DbWorkstream,
    DbJobCard,
    DbAuditLog,
    DbLotInventory,
    DbOffcutInventory,
    DbCuttingGroupMatrix,
    DbNotification,
)

router = APIRouter(prefix="/api", tags=["customers"])

PPF_DEFAULTS = {"planned_cut_block": "152x1300", "planned_deduction_length_m": 13.0}
WINDOW_FILM_PLAN_FULL = [
    {"job_item": "WINDSHIELD", "material_code": "RT40", "note": "Kính lái — RT40"},
    {"job_item": "REAR_WINDOW", "material_code": "JB20"},
    {"job_item": "FRONT_SIDE", "material_code": "JB20"},
    {"job_item": "REAR_SIDE_TRIANGLE", "material_code": "JB20"},
    {"job_item": "SUNROOF", "material_code": "JB20"},
]


def _uid(s: str = "") -> str:
    return f"{s}{uuid.uuid4().hex[:8].upper()}"


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _audit(
    db: Session,
    request_id: Optional[str],
    transaction_type: str,
    source_type: str,
    source_id: str,
    before_value: Any,
    after_value: Any,
    reason: str,
    actor: str,
    workstream_id: Optional[str] = None,
    workstream_type: Optional[str] = None,
    cut_group_id: Optional[str] = None,
):
    sfx = (workstream_id or request_id or source_id or "SYS")[-4:].upper()
    ts = datetime.date.today().strftime("%Y%m%d")
    db.add(
        DbAuditLog(
            log_id=f"AUD-{ts}-{sfx}-{_uid()[:4]}",
            transaction_id=f"TXN-{ts}-{sfx}-{_uid()[:4]}",
            request_id=request_id,
            workstream_id=workstream_id,
            workstream_type=workstream_type,
            cut_group_id=cut_group_id,
            transaction_type=transaction_type,
            transaction_status="CONFIRMED",
            source_type=source_type,
            source_id=source_id,
            before_value="" if before_value is None else str(before_value),
            after_value="" if after_value is None else str(after_value),
            reason=reason or "",
            actor=actor or "SYSTEM",
            timestamp=_now(),
        )
    )


def _add_notif(db, title, body, notif_type, related_id, related_type, recipient_role):
    db.add(
        DbNotification(
            notif_id=f"NOTIF-{_uid()}",
            title=title,
            body=body,
            notif_type=notif_type,
            related_id=related_id,
            related_type=related_type,
            workstream_id=None,
            workstream_type=None,
            team_type=None,
            recipient_role=recipient_role,
            is_read=False,
            created_at=_now(),
        )
    )


def _pick_ppf_lot(db: Session, ppf_type: str, min_m: float = 13.0):
    return (
        db.query(DbLotInventory)
        .filter(
            DbLotInventory.material_code == ppf_type,
            DbLotInventory.status == "ACTIVE",
            DbLotInventory.is_locked == False,
            DbLotInventory.remaining_length_m >= min_m,
        )
        .order_by(DbLotInventory.import_date.asc())
        .first()
    )


def _pick_jb20_lot(db: Session, min_m: float):
    return (
        db.query(DbLotInventory)
        .filter(
            DbLotInventory.material_code == "JB20",
            DbLotInventory.status == "ACTIVE",
            DbLotInventory.is_locked == False,
            DbLotInventory.remaining_length_m >= min_m,
        )
        .order_by(DbLotInventory.import_date.asc())
        .first()
    )


def _pick_rt40_lot(db: Session, min_m: float = 1.0):
    return (
        db.query(DbLotInventory)
        .filter(
            DbLotInventory.material_code == "RT40",
            DbLotInventory.status == "ACTIVE",
            DbLotInventory.is_locked == False,
            DbLotInventory.remaining_length_m >= min_m,
        )
        .order_by(DbLotInventory.import_date.asc())
        .first()
    )


def _pick_jb20_offcut(db: Session, min_len: float, min_w: float = 1.51):
    return (
        db.query(DbOffcutInventory)
        .filter(
            DbOffcutInventory.material_code == "JB20",
            DbOffcutInventory.status == "ACTIVE",
            DbOffcutInventory.is_locked == False,
            DbOffcutInventory.width_m >= min_w,
            DbOffcutInventory.length_m >= min_len,
        )
        .order_by(DbOffcutInventory.length_m.asc())
        .first()
    )


def _wf_cut_group(db: Session, vehicle_model_code: str):
    return (
        db.query(DbCuttingGroupMatrix)
        .filter(
            DbCuttingGroupMatrix.vehicle_model_code == vehicle_model_code,
            DbCuttingGroupMatrix.material_code == "JB20",
            DbCuttingGroupMatrix.status == "ACTIVE",
        )
        .first()
    )


def _material_plan_for_items(items: list) -> list:
    allowed = {p["job_item"] for p in WINDOW_FILM_PLAN_FULL}
    out = []
    for p in WINDOW_FILM_PLAN_FULL:
        if p["job_item"] in items and p["job_item"] in allowed:
            out.append(dict(p))
    return out


def register_customer_routes(app, get_db):
    """Mount customer + manual-create routes."""

    @router.get("/customers/summary")
    def customers_summary(db: Session = Depends(get_db)):
        td = db.query(DbDealer).count()
        active_d = db.query(DbDealer).filter(DbDealer.status == "ACTIVE").count()
        tc = db.query(DbCustomer).count()
        verified = db.query(DbCustomer).filter(DbCustomer.crm_status == "VERIFIED").count()
        pending = db.query(DbCustomer).filter(
            DbCustomer.crm_status == "NEW_PENDING_VERIFICATION"
        ).count()
        tv = db.query(DbVehicleProfile).count()
        wo_cust = db.query(DbVehicleProfile).filter(
            or_(DbVehicleProfile.customer_id == None, DbVehicleProfile.customer_id == "")
        ).count()
        dup_rev = db.query(DbCustomer).filter(DbCustomer.crm_status == "DUPLICATE_REVIEW").count()
        return {
            "total_dealers": td,
            "active_dealers": active_d,
            "total_end_customers": tc,
            "verified_customers": verified,
            "pending_customers": pending,
            "total_vehicles": tv,
            "vehicles_without_customer": wo_cust,
            "duplicate_review_count": dup_rev,
        }

    @router.get("/dealers")
    def list_dealers(
        db: Session = Depends(get_db),
        q: Optional[str] = None,
        status: Optional[str] = None,
        dealer_group: Optional[str] = None,
    ):
        query = db.query(DbDealer)
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    DbDealer.dealer_id.like(like),
                    DbDealer.dealer_name.like(like),
                    DbDealer.legal_name.like(like),
                )
            )
        if status:
            query = query.filter(DbDealer.status == status)
        if dealer_group:
            query = query.filter(DbDealer.dealer_group == dealer_group)
        return query.order_by(DbDealer.dealer_id).all()

    @router.post("/dealers")
    def create_dealer(data: dict, db: Session = Depends(get_db)):
        did = (data.get("dealer_id") or "").strip()
        if not did:
            raise HTTPException(400, "dealer_id bắt buộc")
        if db.query(DbDealer).filter(DbDealer.dealer_id == did).first():
            raise HTTPException(409, "dealer_id đã tồn tại")
        name = (data.get("dealer_name") or "").strip()
        if not name:
            raise HTTPException(400, "dealer_name bắt buộc")
        actor = data.get("created_by") or "WEB"
        d = DbDealer(
            dealer_id=did,
            dealer_name=name,
            legal_name=data.get("legal_name"),
            dealer_group=data.get("dealer_group"),
            tax_code=data.get("tax_code"),
            address=data.get("address"),
            contact_phone=data.get("phone") or data.get("phone_masked"),
            contact_person=data.get("contact_person"),
            email=data.get("email"),
            status=data.get("status") or "ACTIVE",
            created_at=_now(),
            note=data.get("note"),
        )
        db.add(d)
        _audit(db, None, "DEALER_CREATED", "DEALER", did, None, name, data.get("note") or "", actor)
        db.commit()
        db.refresh(d)
        return d

    @router.put("/dealers/{dealer_id}")
    def update_dealer(dealer_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc khi cập nhật dealer")
        d = db.query(DbDealer).filter(DbDealer.dealer_id == dealer_id).first()
        if not d:
            raise HTTPException(404, "Không tìm thấy dealer")
        actor = data.get("updated_by") or "WEB"
        before = {
            "dealer_name": d.dealer_name,
            "legal_name": d.legal_name,
            "dealer_group": d.dealer_group,
            "status": d.status,
            "address": d.address,
            "contact_phone": d.contact_phone,
        }
        for field in ("dealer_name", "legal_name", "dealer_group", "tax_code", "address",
                      "contact_phone", "contact_person", "email", "status", "note"):
            if field in data and data[field] is not None:
                setattr(d, field, data[field])
        d.updated_at = _now()
        after = {
            "dealer_name": d.dealer_name,
            "legal_name": d.legal_name,
            "dealer_group": d.dealer_group,
            "status": d.status,
            "address": d.address,
            "contact_phone": d.contact_phone,
        }
        _audit(
            db,
            None,
            "DEALER_UPDATED",
            "DEALER",
            dealer_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(d)
        return d

    @router.get("/end-customers")
    def list_end_customers(
        db: Session = Depends(get_db),
        q: Optional[str] = None,
        source_dealer_id: Optional[str] = None,
        customer_type: Optional[str] = None,
        crm_status: Optional[str] = None,
    ):
        query = db.query(DbCustomer)
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    DbCustomer.customer_id.like(like),
                    DbCustomer.customer_name.like(like),
                    DbCustomer.customer_masked.like(like),
                )
            )
        if source_dealer_id:
            query = query.filter(DbCustomer.source_dealer_id == source_dealer_id)
        if customer_type:
            query = query.filter(DbCustomer.customer_type == customer_type)
        if crm_status:
            query = query.filter(DbCustomer.crm_status == crm_status)
        return query.order_by(DbCustomer.customer_id).all()

    @router.post("/end-customers")
    def create_end_customer(data: dict, db: Session = Depends(get_db)):
        cid = (data.get("customer_id") or "").strip()
        if not cid:
            raise HTTPException(400, "customer_id bắt buộc")
        if db.query(DbCustomer).filter(DbCustomer.customer_id == cid).first():
            raise HTTPException(409, "customer_id đã tồn tại")
        masked = (data.get("customer_masked") or data.get("customer_name") or "").strip()
        if not masked:
            raise HTTPException(400, "customer_masked hoặc customer_name bắt buộc")
        ch = data.get("source_channel") or "MANUAL"
        if ch == "DEALER" and not (data.get("source_dealer_id") or "").strip():
            pass  # nên có — chỉ cảnh báo business, không chặn cứng demo
        actor = data.get("created_by") or "WEB"
        c = DbCustomer(
            customer_id=cid,
            customer_name=data.get("customer_name") or masked,
            customer_masked=masked,
            phone=data.get("phone"),
            phone_masked=data.get("phone_masked"),
            email=data.get("email"),
            address=data.get("address"),
            address_masked=data.get("address_masked"),
            source_dealer_id=data.get("source_dealer_id"),
            customer_type=data.get("customer_type") or "END_CUSTOMER",
            source_channel=ch,
            crm_status=data.get("crm_status") or "NEW_PENDING_VERIFICATION",
            consent_status=data.get("consent_status") or "UNKNOWN",
            created_from_request_id=data.get("created_from_request_id"),
            status="ACTIVE",
            created_at=_now(),
            note=data.get("note"),
        )
        db.add(c)
        _audit(db, None, "CUSTOMER_CREATED", "CUSTOMER", cid, None, masked, data.get("note") or "", actor)
        db.commit()
        db.refresh(c)
        return c

    @router.put("/end-customers/{customer_id}")
    def update_end_customer(customer_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        c = db.query(DbCustomer).filter(DbCustomer.customer_id == customer_id).first()
        if not c:
            raise HTTPException(404, "Không tìm thấy khách hàng")
        actor = data.get("updated_by") or "WEB"
        if c.crm_status == "VERIFIED":
            risky = ("customer_name", "phone", "address", "customer_masked", "phone_masked", "address_masked")
            for k in risky:
                if k in data and data[k] is not None and str(data[k]) != str(getattr(c, k, None)):
                    raise HTTPException(
                        400,
                        "Không ghi đè dữ liệu đã VERIFIED bằng dữ liệu chưa xác minh (bỏ field hoặc đổi crm_status).",
                    )
        before = {k: getattr(c, k, None) for k in (
            "customer_name", "customer_masked", "crm_status", "phone_masked", "address_masked", "source_channel"
        )}
        for field in (
            "customer_name", "customer_masked", "phone", "phone_masked", "email",
            "address", "address_masked", "customer_type", "source_channel",
            "source_dealer_id", "crm_status", "consent_status", "note",
        ):
            if field in data and data[field] is not None:
                setattr(c, field, data[field])
        c.updated_at = _now()
        after = {k: getattr(c, k, None) for k in before}
        _audit(
            db,
            None,
            "CUSTOMER_UPDATED",
            "CUSTOMER",
            customer_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(c)
        return c

    @router.get("/vehicles")
    def list_vehicles(
        db: Session = Depends(get_db),
        q: Optional[str] = None,
        dealer_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        vehicle_model_code: Optional[str] = None,
        vehicle_status: Optional[str] = None,
    ):
        query = db.query(DbVehicleProfile)
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    DbVehicleProfile.vehicle_id.like(like),
                    DbVehicleProfile.vehicle_model_code.like(like),
                    DbVehicleProfile.model_name.like(like),
                    DbVehicleProfile.vin_masked.like(like),
                    DbVehicleProfile.vin_number.like(like),
                )
            )
        if dealer_id:
            query = query.filter(DbVehicleProfile.dealer_id == dealer_id)
        if customer_id:
            query = query.filter(DbVehicleProfile.customer_id == customer_id)
        if vehicle_model_code:
            query = query.filter(DbVehicleProfile.vehicle_model_code == vehicle_model_code)
        if vehicle_status:
            query = query.filter(DbVehicleProfile.vehicle_status == vehicle_status)
        return query.order_by(DbVehicleProfile.vehicle_id).all()

    @router.post("/vehicles")
    def create_vehicle(data: dict, db: Session = Depends(get_db)):
        vid = (data.get("vehicle_id") or "").strip()
        if not vid:
            raise HTTPException(400, "vehicle_id bắt buộc")
        if db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == vid).first():
            raise HTTPException(409, "vehicle_id đã tồn tại")
        vcode = (data.get("vehicle_model_code") or "").strip()
        if not vcode:
            raise HTTPException(400, "vehicle_model_code bắt buộc")
        vin_raw = (data.get("vin_number") or "").strip() or None
        vin_m = (data.get("vin_masked") or vin_raw or "").strip()
        dup_warn = None
        if vin_raw or vin_m:
            conds = []
            if vin_raw:
                conds.append(DbVehicleProfile.vin_number == vin_raw)
            if vin_m:
                conds.append(DbVehicleProfile.vin_masked == vin_m)
            dup = db.query(DbVehicleProfile).filter(or_(*conds)).first() if conds else None
            if dup and not data.get("confirm_duplicate"):
                dup_warn = {
                    "code": "VIN_DUPLICATE_WARNING",
                    "message": "Phát hiện VIN/vin_masked trùng bản ghi khác. Gửi confirm_duplicate=true để tiếp tục.",
                    "existing_vehicle_id": dup.vehicle_id,
                }
                raise HTTPException(status_code=409, detail=dup_warn)
        actor = data.get("created_by") or "WEB"
        # unique internal vin if forced duplicate confirm
        internal_vin = vin_raw or f"VIN-INTERNAL-{vid}"
        if data.get("confirm_duplicate") and vin_raw:
            internal_vin = f"{vin_raw}::{vid}"
        v = DbVehicleProfile(
            vehicle_id=vid,
            vin_number=internal_vin,
            vin_masked=vin_m or None,
            plate_number=data.get("plate_no") or data.get("plate_number"),
            vehicle_model_code=vcode,
            model_name=data.get("model_name") or vcode,
            model_year=data.get("model_year") or 2026,
            color=data.get("color") or "—",
            customer_id=data.get("customer_id"),
            dealer_id=data.get("dealer_id"),
            delivery_date=data.get("delivery_date"),
            created_from_request_id=data.get("created_from_request_id"),
            vehicle_status=data.get("vehicle_status") or "ACTIVE",
            status="ACTIVE",
            created_at=_now(),
            note=data.get("note"),
        )
        db.add(v)
        _audit(db, None, "VEHICLE_CREATED", "VEHICLE", vid, None, vcode, data.get("note") or "", actor)
        db.commit()
        db.refresh(v)
        out = {"vehicle": v, "duplicate_warning": None}
        if data.get("confirm_duplicate"):
            out["duplicate_warning"] = "Đã tạo với VIN nội bộ phân tách (không ghi đè bản ghi cũ)."
        return out

    @router.get("/vehicles/{vehicle_id}/history")
    def vehicle_history(vehicle_id: str, db: Session = Depends(get_db)):
        v = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == vehicle_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy xe")
        reqs = (
            db.query(DbRequest)
            .filter(DbRequest.vehicle_id == vehicle_id)
            .order_by(DbRequest.created_at.desc())
            .all()
        )
        cust = (
            db.query(DbCustomer).filter(DbCustomer.customer_id == v.customer_id).first()
            if v.customer_id
            else None
        )
        dlr = db.query(DbDealer).filter(DbDealer.dealer_id == v.dealer_id).first() if v.dealer_id else None
        services_done = []
        for r in reqs:
            for ws in db.query(DbWorkstream).filter(DbWorkstream.request_id == r.request_id).all():
                if ws.status in ("CLOSED", "COMPLETED"):
                    services_done.append(
                        {"request_id": r.request_id, "type": ws.workstream_type, "material": ws.selected_material_code}
                    )
        return {
            "vehicle": v,
            "owner_customer": cust,
            "dealer": dlr,
            "requests": reqs,
            "services_completed": services_done,
            "last_delivery_date": v.delivery_date,
        }

    @router.put("/vehicles/{vehicle_id}")
    def update_vehicle(vehicle_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        v = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == vehicle_id).first()
        if not v:
            raise HTTPException(404, "Không tìm thấy xe")
        actor = data.get("updated_by") or "WEB"
        vin_change = "vin_number" in data or "vin_masked" in data
        if vin_change and not reason:
            raise HTTPException(400, "Sửa VIN bắt buộc reason")
        before = {
            "vin_number": v.vin_number,
            "vin_masked": v.vin_masked,
            "vehicle_model_code": v.vehicle_model_code,
            "customer_id": v.customer_id,
            "dealer_id": v.dealer_id,
        }
        for field in (
            "vin_number", "vin_masked", "plate_number", "vehicle_model_code", "model_name",
            "customer_id", "dealer_id", "delivery_date", "vehicle_status", "note",
        ):
            if field in data and data[field] is not None:
                setattr(v, field, data[field])
        v.updated_at = _now()
        after = {
            "vin_number": v.vin_number,
            "vin_masked": v.vin_masked,
            "vehicle_model_code": v.vehicle_model_code,
            "customer_id": v.customer_id,
            "dealer_id": v.dealer_id,
        }
        _audit(
            db,
            None,
            "VEHICLE_UPDATED",
            "VEHICLE",
            vehicle_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(v)
        return v

    @router.get("/customers/{customer_id}/history")
    def customer_history(customer_id: str, db: Session = Depends(get_db)):
        c = db.query(DbCustomer).filter(DbCustomer.customer_id == customer_id).first()
        if not c:
            raise HTTPException(404, "Không tìm thấy khách hàng")
        vehicles = db.query(DbVehicleProfile).filter(DbVehicleProfile.customer_id == customer_id).all()
        reqs = db.query(DbRequest).filter(DbRequest.customer_id == customer_id).order_by(
            DbRequest.created_at.desc()
        ).all()
        req_ids = [r.request_id for r in reqs]
        last_job = None
        if req_ids:
            last_job = (
                db.query(DbJobCard)
                .filter(DbJobCard.request_id.in_(req_ids))
                .order_by(DbJobCard.created_at.desc())
                .first()
            )
        materials_used = []
        for r in reqs[:20]:
            wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == r.request_id).all()
            for ws in wss:
                if ws.status in ("CLOSED", "COMPLETED"):
                    materials_used.append(
                        {
                            "request_id": r.request_id,
                            "workstream_type": ws.workstream_type,
                            "material": ws.selected_material_code,
                            "length_m": ws.actual_length_m or ws.planned_deduction_length_m,
                        }
                    )
        return {
            "customer": c,
            "vehicles": vehicles,
            "requests": reqs,
            "last_job_card": last_job,
            "materials_used_recent": materials_used[:15],
            "warranty_status": None,
        }

    @router.get("/dealers/{dealer_id}/history")
    def dealer_history(dealer_id: str, db: Session = Depends(get_db)):
        d = db.query(DbDealer).filter(DbDealer.dealer_id == dealer_id).first()
        if not d:
            raise HTTPException(404, "Không tìm thấy dealer")
        reqs = db.query(DbRequest).filter(DbRequest.dealer_id == dealer_id).all()
        custs = db.query(DbCustomer).filter(DbCustomer.source_dealer_id == dealer_id).all()
        vehicles = db.query(DbVehicleProfile).filter(DbVehicleProfile.dealer_id == dealer_id).all()
        by_month = {}
        for r in reqs:
            key = (r.created_at or "")[:7] or "unknown"
            by_month[key] = by_month.get(key, 0) + 1
        model_pop = {}
        for r in reqs:
            model_pop[r.vehicle_model_code or "—"] = model_pop.get(r.vehicle_model_code or "—", 0) + 1
        model_pop_sorted = sorted(model_pop.items(), key=lambda x: -x[1])[:8]
        on_time = sum(1 for r in reqs if r.status == "CLOSED")
        closed = sum(1 for r in reqs if r.status == "CLOSED")
        sla_rate = round(on_time / max(len(reqs), 1) * 100, 1)
        return {
            "dealer": d,
            "customers_from_dealer": custs,
            "requests": reqs,
            "vehicles": vehicles,
            "requests_per_month": by_month,
            "completed_count": closed,
            "popular_models": [{"model": m, "count": n} for m, n in model_pop_sorted],
            "revenue_placeholder": None,
            "on_time_sla_rate_percent": sla_rate,
        }

    @router.post("/requests/manual-create")
    def manual_create_request(data: dict, db: Session = Depends(get_db)):
        dealer_id = (data.get("dealer_id") or "").strip()
        dealer_name = (data.get("dealer_name") or "").strip()
        if not dealer_id and not dealer_name:
            raise HTTPException(400, "dealer_id hoặc dealer_name bắt buộc")
        vehicle_model = (data.get("vehicle_model") or data.get("vehicle_model_code") or "").strip()
        if not vehicle_model:
            raise HTTPException(400, "vehicle_model bắt buộc")

        svc = data.get("service_selection") or {}
        inc_ppf = bool(svc.get("include_ppf"))
        inc_wf = bool(svc.get("include_window_film"))
        if not inc_ppf and not inc_wf:
            raise HTTPException(400, "Phải chọn ít nhất một dịch vụ (PPF hoặc phim cách nhiệt)")
        ppf_type = (svc.get("ppf_type") or "").strip()
        if inc_ppf:
            if ppf_type not in ("T-TYPE", "M-TYPE"):
                raise HTTPException(400, "ppf_type bắt buộc và phải là T-TYPE hoặc M-TYPE khi chọn PPF")
        wf_items = svc.get("window_film_items") or [
            "WINDSHIELD",
            "REAR_WINDOW",
            "FRONT_SIDE",
            "REAR_SIDE_TRIANGLE",
            "SUNROOF",
        ]
        if inc_wf and not wf_items:
            raise HTTPException(400, "Chọn ít nhất một hạng mục phim cách nhiệt")

        requested_at = (data.get("requested_delivery_at") or "").strip()
        needs_review = False
        review_notes = []
        if not requested_at:
            needs_review = True
            review_notes.append("Thiếu requested_delivery_at")

        actor = data.get("created_by") or "WEB"
        today = datetime.date.today()
        cnt = db.query(DbRequest).filter(
            DbRequest.request_id.like(f"REQ-{today.strftime('%Y%m%d')}-%")
        ).count()
        new_req_id = f"REQ-{today.strftime('%Y%m%d')}-{str(cnt + 1).zfill(3)}"

        # --- Dealer ---
        if not dealer_id and dealer_name:
            slug = re.sub(r"[^A-Z0-9]+", "_", dealer_name.upper())[:24]
            dealer_id = f"DEALER_{slug}_{_uid()[:4]}"
        d_existing = db.query(DbDealer).filter(DbDealer.dealer_id == dealer_id).first()
        if not d_existing:
            db.add(
                DbDealer(
                    dealer_id=dealer_id,
                    dealer_name=dealer_name or dealer_id,
                    legal_name=data.get("legal_name"),
                    dealer_group=data.get("dealer_group"),
                    address=data.get("dealer_address_masked") or "ADDRESS_MASKED",
                    contact_phone=data.get("dealer_phone_masked"),
                    status="ACTIVE",
                    created_at=_now(),
                )
            )
            _audit(db, new_req_id, "DEALER_CREATED", "DEALER", dealer_id, None, dealer_name or dealer_id, "Tạo khi manual-create", actor)
        else:
            dealer_name = dealer_name or d_existing.dealer_name

        # --- Customer ---
        customer_id = (data.get("customer_id") or "").strip()
        cust_masked = (data.get("customer_masked") or data.get("customer_name") or "").strip()
        if customer_id:
            c = db.query(DbCustomer).filter(DbCustomer.customer_id == customer_id).first()
            if not c:
                db.add(
                    DbCustomer(
                        customer_id=customer_id,
                        customer_name=cust_masked or customer_id,
                        customer_masked=cust_masked or customer_id,
                        phone_masked=data.get("phone_masked"),
                        address_masked=data.get("address_masked"),
                        source_dealer_id=dealer_id,
                        customer_type=data.get("customer_type") or "END_CUSTOMER",
                        source_channel="MANUAL",
                        crm_status="NEW_PENDING_VERIFICATION",
                        created_at=_now(),
                    )
                )
                _audit(db, new_req_id, "CUSTOMER_CREATED", "CUSTOMER", customer_id, None, cust_masked, "manual-create", actor)
        elif cust_masked:
            customer_id = f"CUS-MANUAL-{_uid()[:8]}"
            db.add(
                DbCustomer(
                    customer_id=customer_id,
                    customer_name=cust_masked,
                    customer_masked=cust_masked,
                    phone_masked=data.get("phone_masked"),
                    address_masked=data.get("address_masked"),
                    source_dealer_id=dealer_id,
                    customer_type="END_CUSTOMER",
                    source_channel="MANUAL",
                    crm_status="NEW_PENDING_VERIFICATION",
                    created_at=_now(),
                )
            )
            _audit(db, new_req_id, "CUSTOMER_CREATED", "CUSTOMER", customer_id, None, cust_masked, "manual-create auto-id", actor)
        else:
            customer_id = None

        # --- Vehicle ---
        vehicle_id = (data.get("vehicle_id") or "").strip()
        vin_m = (data.get("vin_masked") or "").strip()
        if vehicle_id:
            vp = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == vehicle_id).first()
            if not vp:
                internal_vin = f"VIN-MANUAL-{vehicle_id}"
                db.add(
                    DbVehicleProfile(
                        vehicle_id=vehicle_id,
                        vin_number=internal_vin,
                        vin_masked=vin_m or internal_vin,
                        vehicle_model_code=vehicle_model,
                        model_name=data.get("model_name") or vehicle_model,
                        customer_id=customer_id,
                        dealer_id=dealer_id,
                        delivery_date=data.get("delivery_date"),
                        vehicle_status="ACTIVE",
                        status="ACTIVE",
                        created_at=_now(),
                    )
                )
                _audit(db, new_req_id, "VEHICLE_CREATED", "VEHICLE", vehicle_id, None, vehicle_model, "manual-create", actor)
        else:
            vehicle_id = f"VEH-MANUAL-{_uid()[:8]}"
            internal_vin = f"VIN-MANUAL-{vehicle_id}"
            db.add(
                DbVehicleProfile(
                    vehicle_id=vehicle_id,
                    vin_number=internal_vin,
                    vin_masked=vin_m or internal_vin,
                    vehicle_model_code=vehicle_model,
                    model_name=data.get("model_name") or vehicle_model,
                    customer_id=customer_id,
                    dealer_id=dealer_id,
                    delivery_date=data.get("delivery_date"),
                    vehicle_status="ACTIVE",
                    status="ACTIVE",
                    created_at=_now(),
                )
            )
            _audit(db, new_req_id, "VEHICLE_CREATED", "VEHICLE", vehicle_id, None, vehicle_model, "manual-create auto vehicle", actor)

        teams = data.get("assigned_teams") or {}
        is_multi = inc_ppf and inc_wf
        job_parts = []
        if inc_ppf:
            job_parts.append("PPF_FULL")
        if inc_wf:
            job_parts.extend(wf_items)
        job_items_str = ";".join(job_parts)

        cg = _wf_cut_group(db, vehicle_model) if inc_wf else None
        wf_plan = _material_plan_for_items(wf_items if inc_wf else [])
        wf_block = "152x143"
        wf_len = 1.43
        if cg:
            wf_block = f"{cg.cut_block_width_cm}x{cg.cut_block_length_cm}"
            wf_len = float(cg.deduction_length_m or wf_len)

        stock_flags = []
        ppf_lot = None
        if inc_ppf:
            ppf_lot = _pick_ppf_lot(db, ppf_type, 13.0)
            if not ppf_lot:
                needs_review = True
                stock_flags.append("OUT_OF_STOCK_PPF")

        wf_source_type, wf_source_id = "LOT", None
        jb20_lot = None
        if inc_wf:
            oc = _pick_jb20_offcut(db, wf_len)
            if oc:
                wf_source_type, wf_source_id = "OFFCUT", oc.offcut_id
            else:
                jb20_lot = _pick_jb20_lot(db, wf_len)
                if jb20_lot:
                    wf_source_type, wf_source_id = "LOT", jb20_lot.lot_id
                else:
                    needs_review = True
                    stock_flags.append("OUT_OF_STOCK_JB20")

        req = DbRequest(
            request_id=new_req_id,
            request_no=data.get("request_no"),
            dealer_id=dealer_id,
            dealer_name=dealer_name or None,
            customer_id=customer_id,
            customer_name=cust_masked or (customer_id or "—"),
            vehicle_id=vehicle_id,
            vin_number=data.get("vin_number") or None,
            vin_masked=vin_m or None,
            vehicle_model_code=vehicle_model,
            material_code="JB20" if inc_wf else (ppf_type if inc_ppf else "JB20"),
            job_items=job_items_str,
            status="NEEDS_REVIEW" if needs_review else "ALLOCATED",
            is_grouped_cut=bool(cg),
            cut_group_id=cg.cut_group_id if cg else None,
            planned_cut_block=PPF_DEFAULTS["planned_cut_block"] if inc_ppf else wf_block,
            planned_deduction_length_m=PPF_DEFAULTS["planned_deduction_length_m"] if inc_ppf else wf_len,
            allocated_source_type="LOT",
            allocated_source_id=(jb20_lot.lot_id if jb20_lot else None) or (ppf_lot.lot_id if ppf_lot else None),
            is_multi_workstream=is_multi,
            requested_delivery_time=requested_at or None,
            created_at=_now(),
            source_channel="MANUAL",
            exception_reason="; ".join(review_notes + stock_flags) if (review_notes or stock_flags) else None,
            service_selection_json=json.dumps(svc, ensure_ascii=False),
        )
        db.add(req)

        created_ws_types = []
        rid_slug = new_req_id.replace("-", "")
        if inc_ppf:
            pp_alloc = ppf_lot.lot_id if ppf_lot else None
            if not pp_alloc:
                pp_alloc = f"LOT-{ppf_type}-PENDING"
            ws_p = DbWorkstream(
                workstream_id=f"WS-PPF-{rid_slug}",
                request_id=new_req_id,
                workstream_type="PPF_INSTALLATION",
                team_type="PPF_TEAM",
                technician_team=teams.get("ppf_team") or "PPF_TEAM_A",
                assigned_technician_id="KTV-PPF-001",
                assigned_technician_name="Trần Văn Bình",
                selected_material_code=ppf_type,
                material_plan=None,
                planned_cut_block=PPF_DEFAULTS["planned_cut_block"],
                planned_deduction_length_m=PPF_DEFAULTS["planned_deduction_length_m"],
                allocated_source_type="LOT" if ppf_lot else None,
                allocated_source_id=pp_alloc if ppf_lot else None,
                status="PENDING_APPROVAL",
                actual_confirmation_status="PENDING",
                created_at=_now(),
            )
            db.add(ws_p)
            created_ws_types.append("PPF_INSTALLATION")

        if inc_wf:
            ws_w = DbWorkstream(
                workstream_id=f"WS-WF-{rid_slug}",
                request_id=new_req_id,
                workstream_type="WINDOW_FILM_INSTALLATION",
                team_type="WINDOW_FILM_TEAM",
                technician_team=teams.get("window_film_team") or "WINDOW_FILM_TEAM_B",
                assigned_technician_id="KTV-003",
                assigned_technician_name="Nguyễn Văn An",
                selected_material_code="JB20",
                material_plan=json.dumps(wf_plan, ensure_ascii=False),
                cut_group_id=cg.cut_group_id if cg else None,
                planned_cut_block=wf_block,
                planned_deduction_length_m=wf_len,
                allocated_source_type=wf_source_type if wf_source_id else None,
                allocated_source_id=wf_source_id,
                status="PENDING_APPROVAL",
                actual_confirmation_status="PENDING",
                created_at=_now(),
            )
            db.add(ws_w)
            created_ws_types.append("WINDOW_FILM_INSTALLATION")

        _audit(
            db,
            new_req_id,
            "REQUEST_MANUAL_CREATED",
            "REQUEST",
            new_req_id,
            None,
            json.dumps({"services": created_ws_types, "stock": stock_flags}, ensure_ascii=False),
            data.get("note") or "manual-create",
            actor,
        )
        _add_notif(
            db,
            "📋 Đơn thủ công mới",
            f"Request {new_req_id} — {', '.join(created_ws_types)}. Chờ duyệt vật tư.",
            "APPROVAL_NEEDED",
            new_req_id,
            "REQUEST",
            "MANAGER",
        )
        db.commit()

        next_step = "MANAGER_APPROVAL"
        return {
            "request_id": new_req_id,
            "status": req.status,
            "created_workstreams": created_ws_types,
            "next_step": next_step,
            "warnings": stock_flags + review_notes,
        }

    @router.put("/requests/{request_id}/edit-pending")
    def edit_pending_request(request_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
        if not req:
            raise HTTPException(404, "Không tìm thấy request")
        if req.status in ("CLOSED", "EXCEPTION_HOLD"):
            if not data.get("admin_override"):
                raise HTTPException(400, "Request đã đóng — không chỉnh sửa (admin_override nếu cần).")
        actor = data.get("updated_by") or "WEB"
        before = {
            "requested_delivery_time": req.requested_delivery_time,
            "dealer_id": req.dealer_id,
            "customer_id": req.customer_id,
            "vehicle_id": req.vehicle_id,
        }
        if "requested_delivery_at" in data:
            req.requested_delivery_time = data["requested_delivery_at"]
        for k in ("dealer_id", "customer_id", "vehicle_id", "dealer_name", "vin_masked"):
            if k in data and data[k] is not None:
                setattr(req, k, data[k])
        if "service_selection" in data and req.status in ("ALLOCATED", "NEEDS_REVIEW", "DRAFT"):
            req.service_selection_json = json.dumps(data["service_selection"], ensure_ascii=False)
            _audit(
                db,
                request_id,
                "SERVICE_SELECTION_UPDATED",
                "REQUEST",
                request_id,
                json.dumps(before, ensure_ascii=False),
                req.service_selection_json,
                reason,
                actor,
            )
        after = {
            "requested_delivery_time": req.requested_delivery_time,
            "dealer_id": req.dealer_id,
            "customer_id": req.customer_id,
            "vehicle_id": req.vehicle_id,
        }
        _audit(
            db,
            request_id,
            "REQUEST_FIELD_UPDATED",
            "REQUEST",
            request_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(req)
        return req

    @router.put("/workstreams/{ws_id}/team-assignment")
    def edit_team_assignment(ws_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
        if not ws:
            raise HTTPException(404, "Không tìm thấy workstream")
        if ws.status not in ("PENDING_APPROVAL",):
            if not data.get("admin_override"):
                raise HTTPException(400, "Chỉ đổi đội khi workstream chưa bắt đầu / chưa duyệt (hoặc admin_override).")
        actor = data.get("updated_by") or "WEB"
        before = {"technician_team": ws.technician_team}
        if "technician_team" in data:
            ws.technician_team = data["technician_team"]
        if "assigned_technician_id" in data:
            ws.assigned_technician_id = data["assigned_technician_id"]
        if "assigned_technician_name" in data:
            ws.assigned_technician_name = data["assigned_technician_name"]
        after = {"technician_team": ws.technician_team}
        _audit(
            db,
            ws.request_id,
            "TEAM_ASSIGNMENT_UPDATED",
            "WORKSTREAM",
            ws_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
            ws_id,
            ws.workstream_type,
        )
        db.commit()
        db.refresh(ws)
        return ws

    app.include_router(router)
