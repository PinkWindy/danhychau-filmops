# -*- coding: utf-8 -*-
"""API định mức phim theo dòng xe / năm model."""
import datetime
import json
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from database import DbVehicleFilmNorm, DbAuditLog
from vehicle_norm_logic import (
    build_auto_fill_items,
    hydrate_norm_sizes_from_strings,
    norm_row_to_dict,
    resolve_vehicle_norm,
    sync_size_string,
)

router = APIRouter(prefix="/api", tags=["vehicle-norms"])


def _parse_bool_query(v: Optional[str]) -> Optional[bool]:
    if v is None or str(v).strip() == "":
        return None
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "on"):
        return True
    if s in ("false", "0", "no", "off"):
        return False
    return None


def _with_meta_flag(with_meta: Optional[str]) -> bool:
    return str(with_meta or "").strip().lower() in ("1", "true", "yes")


def _wrap_norm_list(items: list, with_meta: Optional[str], applied: dict) -> Any:
    if _with_meta_flag(with_meta):
        return {"items": items, "total": len(items), "filters_applied": applied}
    return items


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
):
    ts = datetime.date.today().strftime("%Y%m%d")
    sfx = (source_id or "NORM")[-4:].upper()
    db.add(
        DbAuditLog(
            log_id=f"AUD-{ts}-{sfx}-{_uid()[:4]}",
            transaction_id=f"TXN-{ts}-{sfx}-{_uid()[:4]}",
            request_id=request_id,
            workstream_id=None,
            workstream_type=None,
            cut_group_id=None,
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


def register_vehicle_norm_routes(app, get_db):
    @router.get("/vehicle-norms")
    def list_norms(
        db: Session = Depends(get_db),
        vehicle_model_code: Optional[str] = None,
        film_type: Optional[str] = None,
        status: Optional[str] = None,
        q: Optional[str] = None,
        model_year: Optional[int] = None,
        has_windshield: Optional[str] = None,
        has_sunroof: Optional[str] = None,
        has_rear_side_triangle: Optional[str] = None,
        with_meta: Optional[str] = None,
    ):
        applied: dict = {}
        query = db.query(DbVehicleFilmNorm)
        if vehicle_model_code and str(vehicle_model_code).strip():
            vc = str(vehicle_model_code).strip()
            applied["vehicle_model_code"] = vc
            query = query.filter(func.coalesce(DbVehicleFilmNorm.vehicle_model_code, "").ilike(f"%{vc}%"))
        if film_type and str(film_type).strip():
            ft = str(film_type).strip()
            applied["film_type"] = ft
            query = query.filter(DbVehicleFilmNorm.film_type == ft)
        if status and str(status).strip():
            st = str(status).strip()
            applied["status"] = st
            query = query.filter(DbVehicleFilmNorm.status == st)
        if q and str(q).strip():
            qs = str(q).strip()
            like = f"%{qs}%"
            applied["q"] = qs
            query = query.filter(
                or_(
                    DbVehicleFilmNorm.norm_id.ilike(like),
                    func.coalesce(DbVehicleFilmNorm.vehicle_model_code, "").ilike(like),
                    func.coalesce(DbVehicleFilmNorm.model_year_range, "").ilike(like),
                    func.coalesce(DbVehicleFilmNorm.film_type, "").ilike(like),
                )
            )
        if model_year is not None:
            ys = str(int(model_year))
            applied["model_year"] = int(model_year)
            query = query.filter(DbVehicleFilmNorm.model_year_range.contains(ys))
        hw = _parse_bool_query(has_windshield)
        if hw is True:
            applied["has_windshield"] = True
            query = query.filter(
                or_(
                    DbVehicleFilmNorm.windshield_width_cm > 0,
                    DbVehicleFilmNorm.windshield_length_cm > 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.windshield_size, ""))) > 0,
                )
            )
        elif hw is False:
            applied["has_windshield"] = False
            query = query.filter(
                and_(
                    func.coalesce(DbVehicleFilmNorm.windshield_width_cm, 0) == 0,
                    func.coalesce(DbVehicleFilmNorm.windshield_length_cm, 0) == 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.windshield_size, ""))) == 0,
                )
            )
        hs = _parse_bool_query(has_sunroof)
        if hs is True:
            applied["has_sunroof"] = True
            query = query.filter(
                or_(
                    DbVehicleFilmNorm.sunroof_width_cm > 0,
                    DbVehicleFilmNorm.sunroof_length_cm > 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.sunroof_size, ""))) > 0,
                )
            )
        elif hs is False:
            applied["has_sunroof"] = False
            query = query.filter(
                and_(
                    func.coalesce(DbVehicleFilmNorm.sunroof_width_cm, 0) == 0,
                    func.coalesce(DbVehicleFilmNorm.sunroof_length_cm, 0) == 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.sunroof_size, ""))) == 0,
                )
            )
        hrt = _parse_bool_query(has_rear_side_triangle)
        if hrt is True:
            applied["has_rear_side_triangle"] = True
            query = query.filter(
                or_(
                    DbVehicleFilmNorm.rear_side_triangle_width_cm > 0,
                    DbVehicleFilmNorm.rear_side_triangle_length_cm > 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.rear_side_triangle_size, ""))) > 0,
                )
            )
        elif hrt is False:
            applied["has_rear_side_triangle"] = False
            query = query.filter(
                and_(
                    func.coalesce(DbVehicleFilmNorm.rear_side_triangle_width_cm, 0) == 0,
                    func.coalesce(DbVehicleFilmNorm.rear_side_triangle_length_cm, 0) == 0,
                    func.length(func.trim(func.coalesce(DbVehicleFilmNorm.rear_side_triangle_size, ""))) == 0,
                )
            )
        rows = query.order_by(DbVehicleFilmNorm.norm_id).all()
        items = [norm_row_to_dict(r) for r in rows]
        return _wrap_norm_list(items, with_meta, applied)

    @router.get("/vehicle-norms/resolve")
    def resolve_norm(
        db: Session = Depends(get_db),
        vehicle_model_code: str = Query(...),
        model_year: Optional[int] = Query(None),
        film_type: str = Query(...),
    ):
        return resolve_vehicle_norm(db, vehicle_model_code.strip(), model_year, film_type.strip())

    @router.post("/vehicle-norms")
    def create_norm(data: dict, db: Session = Depends(get_db)):
        data = dict(data)
        hydrate_norm_sizes_from_strings(data)
        vcode = (data.get("vehicle_model_code") or "").strip()
        ft = (data.get("film_type") or "").strip()
        myr = (data.get("model_year_range") or "").strip()
        if not vcode:
            raise HTTPException(400, "vehicle_model_code bắt buộc")
        if not ft:
            raise HTTPException(400, "film_type bắt buộc")
        if not myr:
            raise HTTPException(400, "model_year_range bắt buộc")
        dup = (
            db.query(DbVehicleFilmNorm)
            .filter(
                DbVehicleFilmNorm.vehicle_model_code == vcode,
                DbVehicleFilmNorm.film_type == ft,
                DbVehicleFilmNorm.model_year_range == myr,
                DbVehicleFilmNorm.status == "ACTIVE",
            )
            .first()
        )
        if dup:
            raise HTTPException(409, "Đã tồn tại định mức ACTIVE cùng dòng xe + loại phim + khoảng năm")
        nid = (data.get("norm_id") or "").strip() or f"NORM-{vcode}-{_uid()[:6]}"
        if db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == nid).first():
            raise HTTPException(409, "norm_id đã tồn tại")
        actor = data.get("created_by") or "WEB"
        row = DbVehicleFilmNorm(
            norm_id=nid,
            film_type=ft,
            vehicle_model_code=vcode,
            model_year_range=myr,
            windshield_size=data.get("windshield_size"),
            windshield_width_cm=float(data.get("windshield_width_cm") or 0),
            windshield_length_cm=float(data.get("windshield_length_cm") or 0),
            rear_window_size=data.get("rear_window_size"),
            rear_window_width_cm=float(data.get("rear_window_width_cm") or 0),
            rear_window_length_cm=float(data.get("rear_window_length_cm") or 0),
            front_side_size=data.get("front_side_size"),
            front_side_width_cm=float(data.get("front_side_width_cm") or 0),
            front_side_length_cm=float(data.get("front_side_length_cm") or 0),
            rear_side_triangle_size=data.get("rear_side_triangle_size"),
            rear_side_triangle_width_cm=float(data.get("rear_side_triangle_width_cm") or 0),
            rear_side_triangle_length_cm=float(data.get("rear_side_triangle_length_cm") or 0),
            triangle_size=data.get("triangle_size") or "",
            triangle_width_cm=float(data.get("triangle_width_cm") or 0),
            triangle_length_cm=float(data.get("triangle_length_cm") or 0),
            rear_side_size=data.get("rear_side_size") or "",
            rear_side_width_cm=float(data.get("rear_side_width_cm") or 0),
            rear_side_length_cm=float(data.get("rear_side_length_cm") or 0),
            sunroof_size=data.get("sunroof_size") or "",
            sunroof_width_cm=float(data.get("sunroof_width_cm") or 0),
            sunroof_length_cm=float(data.get("sunroof_length_cm") or 0),
            status=data.get("status") or "ACTIVE",
            created_at=_now(),
            note=data.get("note"),
        )
        db.add(row)
        _audit(db, None, "VEHICLE_NORM_CREATED", "VEHICLE_NORM", nid, None, json.dumps(norm_row_to_dict(row), ensure_ascii=False), data.get("note") or "", actor)
        db.commit()
        db.refresh(row)
        return norm_row_to_dict(row)

    @router.put("/vehicle-norms/{norm_id}")
    def update_norm(norm_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == norm_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy định mức")
        actor = data.get("updated_by") or "WEB"
        before = norm_row_to_dict(row)
        data = dict(data)
        hydrate_norm_sizes_from_strings(data)
        float_fields = [
            "windshield_width_cm", "windshield_length_cm",
            "rear_window_width_cm", "rear_window_length_cm",
            "front_side_width_cm", "front_side_length_cm",
            "rear_side_triangle_width_cm", "rear_side_triangle_length_cm",
            "triangle_width_cm", "triangle_length_cm",
            "rear_side_width_cm", "rear_side_length_cm",
            "sunroof_width_cm", "sunroof_length_cm",
        ]
        str_fields = [
            "film_type", "vehicle_model_code", "model_year_range",
            "windshield_size", "rear_window_size", "front_side_size", "rear_side_triangle_size",
            "triangle_size", "rear_side_size", "sunroof_size", "status", "note",
        ]
        for f in float_fields:
            if f in data and data[f] is not None:
                setattr(row, f, float(data[f]))
        for f in str_fields:
            if f in data and data[f] is not None:
                setattr(row, f, data[f])
        # sync size strings from cm
        row.windshield_size = sync_size_string(row.windshield_width_cm, row.windshield_length_cm, row.windshield_size)
        row.rear_window_size = sync_size_string(row.rear_window_width_cm, row.rear_window_length_cm, row.rear_window_size)
        row.front_side_size = sync_size_string(row.front_side_width_cm, row.front_side_length_cm, row.front_side_size)
        row.rear_side_triangle_size = sync_size_string(
            row.rear_side_triangle_width_cm, row.rear_side_triangle_length_cm, row.rear_side_triangle_size
        )
        row.triangle_size = sync_size_string(row.triangle_width_cm, row.triangle_length_cm, row.triangle_size)
        row.rear_side_size = sync_size_string(row.rear_side_width_cm, row.rear_side_length_cm, row.rear_side_size)
        row.sunroof_size = sync_size_string(row.sunroof_width_cm, row.sunroof_length_cm, row.sunroof_size)
        row.updated_at = _now()
        after = norm_row_to_dict(row)
        _audit(
            db,
            None,
            "VEHICLE_NORM_UPDATED",
            "VEHICLE_NORM",
            norm_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(row)
        return after

    @router.post("/vehicle-norms/{norm_id}/activate")
    def activate_norm(norm_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == norm_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy định mức")
        actor = data.get("updated_by") or "WEB"
        before = row.status
        row.status = "ACTIVE"
        row.updated_at = _now()
        _audit(db, None, "VEHICLE_NORM_ACTIVATED", "VEHICLE_NORM", norm_id, before, "ACTIVE", reason, actor)
        db.commit()
        db.refresh(row)
        return norm_row_to_dict(row)

    @router.post("/vehicle-norms/{norm_id}/deactivate")
    def deactivate_norm(norm_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == norm_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy định mức")
        actor = data.get("updated_by") or "WEB"
        before = row.status
        row.status = "INACTIVE"
        row.updated_at = _now()
        _audit(db, None, "VEHICLE_NORM_DEACTIVATED", "VEHICLE_NORM", norm_id, before, "INACTIVE", reason, actor)
        db.commit()
        db.refresh(row)
        return norm_row_to_dict(row)

    app.include_router(router)
