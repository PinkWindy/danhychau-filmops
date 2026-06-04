# -*- coding: utf-8 -*-
"""API cấu hình vật tư ưu tiên theo hạng mục kính / PPF."""
import datetime
import json
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import DbMaterialPreference, DbAuditLog
from material_preference_logic import resolve_material_preference

router = APIRouter(prefix="/api", tags=["material-preferences"])


def _uid(p: str = "") -> str:
    return f"{p}{uuid.uuid4().hex[:8].upper()}"


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _audit(
    db: Session,
    transaction_type: str,
    source_id: str,
    before_value: Any,
    after_value: Any,
    reason: str,
    actor: str,
):
    ts = datetime.date.today().strftime("%Y%m%d")
    sfx = (source_id or "MAT")[-4:].upper()
    db.add(
        DbAuditLog(
            log_id=f"AUD-{ts}-{sfx}-{_uid()[:4]}",
            transaction_id=f"TXN-{ts}-{sfx}-{_uid()[:4]}",
            request_id=None,
            workstream_id=None,
            workstream_type=None,
            cut_group_id=None,
            transaction_type=transaction_type,
            transaction_status="CONFIRMED",
            source_type="MATERIAL_PREFERENCE",
            source_id=source_id,
            before_value="" if before_value is None else str(before_value),
            after_value="" if after_value is None else str(after_value),
            reason=reason or "",
            actor=actor or "SYSTEM",
            timestamp=_now(),
        )
    )


def _row_to_dict(r: DbMaterialPreference) -> dict:
    return {
        "preference_id": r.preference_id,
        "film_type": r.film_type,
        "job_item": r.job_item,
        "preferred_material_code": r.preferred_material_code,
        "material_name": r.material_name,
        "priority": int(r.priority or 1),
        "status": r.status,
        "effective_from": r.effective_from,
        "effective_to": r.effective_to,
        "note": r.note,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def register_material_preference_routes(app, get_db):
    @router.get("/material-preferences")
    def list_preferences(
        db: Session = Depends(get_db),
        film_type: Optional[str] = None,
        job_item: Optional[str] = None,
        status: Optional[str] = None,
        q: Optional[str] = None,
    ):
        qry = db.query(DbMaterialPreference)
        if film_type and str(film_type).strip():
            qry = qry.filter(DbMaterialPreference.film_type == str(film_type).strip())
        if job_item and str(job_item).strip():
            qry = qry.filter(DbMaterialPreference.job_item == str(job_item).strip())
        if status and str(status).strip():
            qry = qry.filter(DbMaterialPreference.status == str(status).strip())
        if q and str(q).strip():
            qs = f"%{str(q).strip()}%"
            qry = qry.filter(
                or_(
                    DbMaterialPreference.preference_id.ilike(qs),
                    DbMaterialPreference.preferred_material_code.ilike(qs),
                    func.coalesce(DbMaterialPreference.material_name, "").ilike(qs),
                )
            )
        rows = qry.order_by(
            DbMaterialPreference.film_type,
            DbMaterialPreference.job_item,
            DbMaterialPreference.priority,
        ).all()
        items = [_row_to_dict(r) for r in rows]
        return {"items": items, "total": len(items)}

    @router.get("/material-preferences/resolve")
    def resolve_pref(
        db: Session = Depends(get_db),
        film_type: str = Query(...),
        job_item: str = Query(...),
        ppf_material: Optional[str] = Query(None),
    ):
        return resolve_material_preference(
            db,
            film_type.strip(),
            job_item.strip(),
            ppf_material=(ppf_material.strip() if ppf_material else None),
        )

    @router.post("/material-preferences")
    def create_pref(data: dict, db: Session = Depends(get_db)):
        ft = (data.get("film_type") or "").strip()
        ji = (data.get("job_item") or "").strip()
        mc = (data.get("preferred_material_code") or "").strip()
        if not ft:
            raise HTTPException(400, "film_type bắt buộc")
        if not ji:
            raise HTTPException(400, "job_item bắt buộc")
        if not mc:
            raise HTTPException(400, "preferred_material_code bắt buộc")
        pr = int(data.get("priority") or 1)
        if pr <= 0:
            raise HTTPException(400, "priority phải > 0")
        st = (data.get("status") or "ACTIVE").strip()
        dup = (
            db.query(DbMaterialPreference)
            .filter(
                DbMaterialPreference.film_type == ft,
                DbMaterialPreference.job_item == ji,
                DbMaterialPreference.preferred_material_code == mc,
                DbMaterialPreference.status == "ACTIVE",
            )
            .first()
        )
        if dup and st == "ACTIVE":
            raise HTTPException(409, "Đã tồn tại cấu hình ACTIVE trùng film_type + job_item + preferred_material_code")
        pid = (data.get("preference_id") or "").strip() or f"MATPREF-{_uid()[:6]}"
        if db.query(DbMaterialPreference).filter(DbMaterialPreference.preference_id == pid).first():
            raise HTTPException(409, "preference_id đã tồn tại")
        actor = data.get("created_by") or "WEB"
        row = DbMaterialPreference(
            preference_id=pid,
            film_type=ft,
            job_item=ji,
            preferred_material_code=mc,
            material_name=data.get("material_name"),
            priority=pr,
            status=st,
            effective_from=data.get("effective_from"),
            effective_to=data.get("effective_to"),
            note=data.get("note"),
            created_at=_now(),
        )
        db.add(row)
        _audit(db, "MATERIAL_PREFERENCE_CREATED", pid, None, json.dumps(_row_to_dict(row), ensure_ascii=False), data.get("note") or "", actor)
        db.commit()
        db.refresh(row)
        return _row_to_dict(row)

    @router.put("/material-preferences/{preference_id}")
    def update_pref(preference_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbMaterialPreference).filter(DbMaterialPreference.preference_id == preference_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy cấu hình")
        actor = data.get("updated_by") or "WEB"
        before = _row_to_dict(row)
        for f in (
            "film_type",
            "job_item",
            "preferred_material_code",
            "material_name",
            "priority",
            "status",
            "effective_from",
            "effective_to",
            "note",
        ):
            if f in data and data[f] is not None:
                if f == "priority":
                    pr = int(data[f])
                    if pr <= 0:
                        raise HTTPException(400, "priority phải > 0")
                    setattr(row, f, pr)
                else:
                    setattr(row, f, data[f])
        row.updated_at = _now()
        after = _row_to_dict(row)
        _audit(
            db,
            "MATERIAL_PREFERENCE_UPDATED",
            preference_id,
            json.dumps(before, ensure_ascii=False),
            json.dumps(after, ensure_ascii=False),
            reason,
            actor,
        )
        db.commit()
        db.refresh(row)
        return after

    @router.post("/material-preferences/{preference_id}/activate")
    def activate_pref(preference_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbMaterialPreference).filter(DbMaterialPreference.preference_id == preference_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy cấu hình")
        actor = data.get("updated_by") or "WEB"
        b = row.status
        row.status = "ACTIVE"
        row.updated_at = _now()
        _audit(db, "MATERIAL_PREFERENCE_ACTIVATED", preference_id, b, "ACTIVE", reason, actor)
        db.commit()
        db.refresh(row)
        return _row_to_dict(row)

    @router.post("/material-preferences/{preference_id}/deactivate")
    def deactivate_pref(preference_id: str, data: dict, db: Session = Depends(get_db)):
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise HTTPException(400, "reason bắt buộc")
        row = db.query(DbMaterialPreference).filter(DbMaterialPreference.preference_id == preference_id).first()
        if not row:
            raise HTTPException(404, "Không tìm thấy cấu hình")
        actor = data.get("updated_by") or "WEB"
        b = row.status
        row.status = "INACTIVE"
        row.updated_at = _now()
        _audit(db, "MATERIAL_PREFERENCE_DEACTIVATED", preference_id, b, "INACTIVE", reason, actor)
        db.commit()
        db.refresh(row)
        return _row_to_dict(row)

    app.include_router(router)
