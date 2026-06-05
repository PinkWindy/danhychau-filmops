# -*- coding: utf-8 -*-
"""
Dữ liệu seed chuẩn demo DYC — idempotent theo khóa chính (merge/upsert).
Chạy sau reset DB (warehouse_demo.db mới) qua reset_database_full_seed.py.
"""
from __future__ import annotations

import datetime
import json
import os
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from database import (
    DbAuditLog,
    DbCustomer,
    DbCuttingGroupMatrix,
    DbDealer,
    DbInventoryTransaction,
    DbJobCard,
    DbLotInventory,
    DbNotification,
    DbOffcutInventory,
    DbOcrDraft,
    DbRequest,
    DbVehicleFilmNorm,
    DbVehicleProfile,
    DbWorkstream,
    DbMaterialPreference,
)
from ocr_lexus_test_data import upsert_lexus_ocr_drafts
from ppf_allocation_service import PPF_ITEM_DEFINITIONS, PPF_FULL_REQUIRED_M, DEFAULT_PPF_BLOCK


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _today_date() -> str:
    return datetime.date.today().isoformat()


def _uid(prefix: str = "LOG") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


def _merge_dealer(db: Session, **kw) -> None:
    did = kw["dealer_id"]
    row = db.query(DbDealer).filter(DbDealer.dealer_id == did).first()
    if not row:
        row = DbDealer(dealer_id=did, dealer_name=kw.get("dealer_name") or did)
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    row.updated_at = _now_iso()
    if not row.created_at:
        row.created_at = _now_iso()


def _merge_customer(db: Session, **kw) -> None:
    cid = kw["customer_id"]
    row = db.query(DbCustomer).filter(DbCustomer.customer_id == cid).first()
    if not row:
        row = DbCustomer(customer_id=cid, customer_name=kw.get("customer_name") or cid)
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    row.updated_at = _now_iso()
    if not row.created_at:
        row.created_at = _now_iso()


def _merge_vehicle(db: Session, **kw) -> None:
    vid = kw["vehicle_id"]
    row = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == vid).first()
    if not row:
        row = DbVehicleProfile(vehicle_id=vid, vin_number=kw.get("vin_number") or kw.get("vin_masked") or f"VIN-PLACEHOLDER-{vid}")
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    if not (row.vin_number or "").strip():
        row.vin_number = (row.vin_masked or "").strip() or f"VIN-PLACEHOLDER-{vid}"
    row.updated_at = _now_iso()
    if not row.created_at:
        row.created_at = _now_iso()


def _merge_lot(db: Session, **kw) -> None:
    lid = kw["lot_id"]
    row = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lid).first()
    if not row:
        row = DbLotInventory(lot_id=lid, material_code=kw["material_code"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)


def _merge_offcut(db: Session, **kw) -> None:
    oid = kw["offcut_id"]
    row = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == oid).first()
    if not row:
        row = DbOffcutInventory(offcut_id=oid, material_code=kw["material_code"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)


def _merge_norm(db: Session, **kw) -> None:
    nid = kw["norm_id"]
    row = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == nid).first()
    if not row:
        row = DbVehicleFilmNorm(norm_id=nid, film_type=kw["film_type"], vehicle_model_code=kw["vehicle_model_code"], model_year_range=kw["model_year_range"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    row.updated_at = _now_iso()
    if not row.created_at:
        row.created_at = _now_iso()


def _merge_material_pref(db: Session, **kw) -> None:
    pid = kw["preference_id"]
    row = db.query(DbMaterialPreference).filter(DbMaterialPreference.preference_id == pid).first()
    if not row:
        row = DbMaterialPreference(preference_id=pid, film_type=kw["film_type"], job_item=kw["job_item"], preferred_material_code=kw["preferred_material_code"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    row.updated_at = _now_iso()
    if not row.created_at:
        row.created_at = _now_iso()


def seed_dealers(db: Session) -> None:
    ts = _now_iso()
    _merge_dealer(
        db,
        dealer_id="DEALER_LEXUS_SG",
        customer_category="DEALER",
        dealer_name="LEXUS TRUNG TÂM SÀI GÒN – Công Ty TNHH Ôtô Toyotsu Samco",
        legal_name="Công Ty TNHH Ôtô Toyotsu Samco",
        dealer_group="Lexus",
        tax_code="0312348339",
        contact_phone="02837271555",
        address_no="Số 264",
        street="Trần Hưng Đạo",
        ward="Phường Cầu Ông Lãnh",
        city="Tp Hồ Chí Minh",
        full_address="Số 264, Đường Trần Hưng Đạo, Phường Cầu Ông Lãnh, Tp Hồ Chí Minh",
        amis_customer_code="KH00009",
        status="ACTIVE",
        address="Số 264, Đường Trần Hưng Đạo, Phường Cầu Ông Lãnh, Tp Hồ Chí Minh",
        created_at=ts,
    )
    _merge_dealer(
        db,
        dealer_id="DEALER_TOYOTA_BENTHANH",
        customer_category="DEALER",
        dealer_name="Toyota Bến Thành — Demo",
        legal_name="Công Ty Toyota Bến Thành Demo",
        dealer_group="Toyota",
        tax_code="0300999999",
        contact_phone="02839123456",
        city="Tp Hồ Chí Minh",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_dealer(
        db,
        dealer_id="DEALER_BMW_PMH",
        customer_category="DEALER",
        dealer_name="BMW Phú Mỹ Hưng — Demo",
        legal_name="BMW PMH Demo",
        dealer_group="BMW",
        city="Tp Hồ Chí Minh",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_dealer(
        db,
        dealer_id="DEALER_MERCEDES_HCM",
        customer_category="DEALER",
        dealer_name="Mercedes-Benz HCM — Demo",
        legal_name="Mercedes HCM Demo",
        dealer_group="Mercedes",
        city="Tp Hồ Chí Minh",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_dealer(
        db,
        dealer_id="DEALER_DIRECT_RETAIL",
        customer_category="DEALER",
        dealer_name="Direct Retail — Demo",
        legal_name="Direct Retail Demo",
        dealer_group="Direct Retail",
        city="Tp Hồ Chí Minh",
        status="ACTIVE",
        created_at=ts,
    )


def _purge_amis_smoke_end_customers(db: Session) -> int:
    """Xóa khách lẻ smoke AMIS (customer_id CUS-AMIS-*) và request/xe liên quan."""
    ids = [r[0] for r in db.query(DbCustomer.customer_id).filter(DbCustomer.customer_id.like("CUS-AMIS-%")).all()]
    n = 0
    for cid in ids:
        rids = [x[0] for x in db.query(DbRequest.request_id).filter(DbRequest.customer_id == cid).all()]
        for rid in rids:
            db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete(synchronize_session=False)
            db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete(synchronize_session=False)
            db.query(DbAuditLog).filter(DbAuditLog.request_id == rid).delete(synchronize_session=False)
            db.query(DbNotification).filter(DbNotification.related_id == rid).delete(synchronize_session=False)
            db.query(DbOcrDraft).filter(DbOcrDraft.created_request_id == rid).delete(synchronize_session=False)
            db.query(DbRequest).filter(DbRequest.request_id == rid).delete(synchronize_session=False)
        db.query(DbVehicleProfile).filter(DbVehicleProfile.customer_id == cid).delete(synchronize_session=False)
        row = db.query(DbCustomer).filter(DbCustomer.customer_id == cid).first()
        if row:
            db.delete(row)
            n += 1
    return n


def seed_end_customers(db: Session) -> None:
    ts = _now_iso()
    _purge_amis_smoke_end_customers(db)
    _merge_customer(
        db,
        customer_id="CUS-LEXUS-115",
        customer_name="Trần Thị Mai Lan",
        customer_masked="Trần Thị Mai Lan",
        phone="0903123456",
        phone_masked="0903123456",
        address="45 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
        address_masked="45 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
        full_address="45 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
        source_channel="OCR",
        source_dealer_id="DEALER_LEXUS_SG",
        crm_status="NEW_PENDING_VERIFICATION",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_customer(
        db,
        customer_id="CUS-LEXUS-117",
        customer_name="Lê Hoàng Nam",
        customer_masked="Lê Hoàng Nam",
        phone="0918765432",
        phone_masked="0918765432",
        address="120 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM",
        address_masked="120 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM",
        full_address="120 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM",
        source_channel="OCR",
        source_dealer_id="DEALER_LEXUS_SG",
        crm_status="NEW_PENDING_VERIFICATION",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_customer(
        db,
        customer_id="CUS-DIRECT-001",
        customer_name="Nguyễn Văn An",
        customer_masked="Nguyễn Văn An",
        phone="0938111222",
        phone_masked="0938111222",
        address="88 Lê Lợi, Quận 1, TP.HCM",
        address_masked="88 Lê Lợi, Quận 1, TP.HCM",
        full_address="88 Lê Lợi, Quận 1, TP.HCM",
        source_channel="DIRECT",
        crm_status="VERIFIED",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_customer(
        db,
        customer_id="CUS-DEALER-001",
        customer_name="Phạm Thị Hương",
        customer_masked="Phạm Thị Hương",
        phone="0987654321",
        phone_masked="0987654321",
        address="15 Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
        address_masked="15 Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
        full_address="15 Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
        source_channel="DEALER",
        source_dealer_id="DEALER_TOYOTA_BENTHANH",
        crm_status="VERIFIED",
        status="ACTIVE",
        created_at=ts,
    )


def seed_vehicle_profiles(db: Session) -> None:
    ts = _now_iso()
    _merge_vehicle(
        db,
        vehicle_id="VEH-LEXUS-115",
        customer_id="CUS-LEXUS-115",
        dealer_id="DEALER_LEXUS_SG",
        vehicle_model_code="RX350",
        model_name="RX350H PREMIUM CE",
        model_year=2026,
        vin_number="JTJBARBZ5N2012345",
        vin_masked="JTJBARBZ5N2012345",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-LEXUS-117",
        customer_id="CUS-LEXUS-117",
        dealer_id="DEALER_LEXUS_SG",
        vehicle_model_code="RX350",
        model_name="RX350H PREMIUM CE",
        model_year=2026,
        vin_number="JTJBARBZ6N2012346",
        vin_masked="JTJBARBZ6N2012346",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-RX300-DEMO",
        vehicle_model_code="RX300",
        model_year=2022,
        vin_number="2T3ZF4DV8NW123456",
        vin_masked="2T3ZF4DV8NW123456",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-ES250-DEMO",
        vehicle_model_code="ES250",
        model_year=2024,
        vin_number="JTHBK1GG8N2123456",
        vin_masked="JTHBK1GG8N2123456",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-CAMRY-DEMO",
        vehicle_model_code="CAMRY",
        model_year=2025,
        vin_number="4T1B11HK5NU912345",
        vin_masked="4T1B11HK5NU912345",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-RX350-DEMO",
        customer_id="CUS-DIRECT-001",
        dealer_id="DEALER_LEXUS_SG",
        vehicle_model_code="RX350",
        model_name="RX350H PREMIUM CE",
        model_year=2026,
        vin_number="JTJBARBZ8N0123456",
        vin_masked="JTJBARBZ8N0123456",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH-UNKNOWN-MODEL",
        vehicle_model_code="UNKNOWN_MODEL",
        model_year=2025,
        vin_number="1HGCM82633A004352",
        vin_masked="1HGCM82633A004352",
        vehicle_status="ACTIVE",
        created_at=ts,
    )


def _purge_deprecated_window_film_norm_ids(db: Session) -> None:
    """Xóa bản ghi demo cũ — định mức phim cách nhiệt do người dùng quản lý."""
    for nid in ("NORM-DEMO-RX350-WF-2024-2027", "NORM-RX350-2013-2022"):
        row = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == nid).first()
        if row:
            db.delete(row)


def _purge_smoke_pattern_vehicle_film_norms(db: Session) -> int:
    """Xóa định mức do smoke/script tạo (POST tự động) — không dùng trong vận hành."""
    from sqlalchemy import or_

    q = db.query(DbVehicleFilmNorm).filter(
        or_(
            DbVehicleFilmNorm.norm_id.like("NORM-SMOKE-%"),
            DbVehicleFilmNorm.norm_id.like("NORM-SEED-SMOKE-%"),
        )
    )
    n = 0
    for row in q.all():
        db.delete(row)
        n += 1
    return n


def seed_vehicle_film_norms(db: Session) -> Dict[str, Any]:
    """
    Không import Excel tự động.
    Xóa bản ghi định mức khớp NORM-SMOKE-* / NORM-SEED-SMOKE-* (do smoke từng POST).
    Merge định mức PPF ALL mặc định.
    Định mức phim cách nhiệt (WF): chỉ nhập tay hoặc POST /api/vehicle-norms/import-from-excel.
    """
    _purge_deprecated_window_film_norm_ids(db)
    _purge_smoke_pattern_vehicle_film_norms(db)
    ts = _now_iso()
    _merge_norm(
        db,
        norm_id="NORM-PPF-ALL-ALL-DEFAULT",
        film_type="PPF",
        vehicle_model_code="ALL",
        model_year_range="ALL",
        windshield_size="152x1300",
        windshield_width_cm=152,
        windshield_length_cm=1300,
        rear_window_size="",
        rear_window_width_cm=0,
        rear_window_length_cm=0,
        front_side_size="",
        front_side_width_cm=0,
        front_side_length_cm=0,
        rear_side_triangle_size="",
        rear_side_triangle_width_cm=0,
        rear_side_triangle_length_cm=0,
        triangle_size="",
        triangle_width_cm=0,
        triangle_length_cm=0,
        rear_side_size="",
        rear_side_width_cm=0,
        rear_side_length_cm=0,
        sunroof_size="",
        sunroof_width_cm=0,
        sunroof_length_cm=0,
        status="ACTIVE",
        note=json.dumps(
            {"item_code": "FULL_VEHICLE_PPF", "item_name": "Full xe", "planned_size": "152x1300", "required_length_m": 13.0},
            ensure_ascii=False,
        ),
        created_at=ts,
        updated_at=ts,
    )
    return {
        "ok": True,
        "window_film_norms": "manual_only",
        "excel_auto_import": False,
        "ppf_default_norm": True,
    }


def seed_material_preferences(db: Session) -> None:
    """Đồng bộ preference_id với populate_db._seed_material_preferences để smoke test cũ không tạo bản ACTIVE trùng."""
    ft_wf = "Phim cách nhiệt"
    specs: List[Dict[str, Any]] = [
        ("MATPREF-WINDSHIELD", ft_wf, "WINDSHIELD", "RT40", "Phim cách nhiệt Konica RT40", 1),
        ("MATPREF-REAR", ft_wf, "REAR_WINDOW", "JB20", "Phim cách nhiệt Konica JB20", 1),
        ("MATPREF-FRONT", ft_wf, "FRONT_SIDE", "JB20", None, 1),
        ("MATPREF-RST", ft_wf, "REAR_SIDE_TRIANGLE", "JB20", None, 1),
        ("MATPREF-TRI", ft_wf, "TRIANGLE", "JB20", None, 1),
        ("MATPREF-RS", ft_wf, "REAR_SIDE", "JB20", None, 1),
        ("MATPREF-SUN", ft_wf, "SUNROOF", "JB20", None, 1),
        ("MATPREF-PPF-T", "PPF", "PPF_BODY", "T-TYPE", "Phim PPF Climax trong", 1),
        ("MATPREF-PPF-M", "PPF", "PPF_BODY", "M-TYPE", "Phim PPF Climax mờ", 2),
    ]
    for pid, ft, ji, mc, mn, pr in specs:
        _merge_material_pref(
            db,
            preference_id=pid,
            film_type=ft,
            job_item=ji,
            preferred_material_code=mc,
            material_name=mn,
            priority=pr,
            status="ACTIVE",
        )


def seed_inventory_lots(db: Session) -> None:
    d = _today_date()
    lots: List[Dict[str, Any]] = [
        dict(
            lot_id="LOT-RT40-001",
            material_code="RT40",
            material_name="Phim cách nhiệt Konica RT40",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=30.0,
            lot_status="NEW",
            is_locked=False,
            is_opened=False,
            storage_location="A-RACK-RT40-01",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-RT40-002",
            material_code="RT40",
            material_name="Phim cách nhiệt Konica RT40",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=18.0,
            lot_status="IN_USE",
            is_locked=False,
            is_opened=True,
            storage_location="A-RACK-RT40-02",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-JB20-001",
            material_code="JB20",
            material_name="Phim cách nhiệt Konica JB20",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=27.0,
            lot_status="IN_USE",
            is_locked=False,
            is_opened=True,
            storage_location="A-RACK-JB20-01",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-JB20-002",
            material_code="JB20",
            material_name="Phim cách nhiệt Konica JB20",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=9.97,
            lot_status="IN_USE",
            is_locked=False,
            is_opened=True,
            storage_location="A-RACK-JB20-02",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-TTYPE-001",
            material_code="T-TYPE",
            material_name="Phim PPF Climax T-TYPE",
            film_type="PPF",
            manufacturer="Climax",
            original_width_m=1.52,
            original_length_m=15.0,
            remaining_length_m=7.2,
            lot_status="IN_USE",
            is_opened=True,
            storage_location="A-RACK-TTYPE-01",
            import_date=d,
            status="ACTIVE",
            note="dùng để demo PPF 1 LOT không đủ 13m",
        ),
        dict(
            lot_id="LOT-TTYPE-002",
            material_code="T-TYPE",
            material_name="Phim PPF Climax T-TYPE",
            film_type="PPF",
            manufacturer="Climax",
            original_width_m=1.52,
            original_length_m=15.0,
            remaining_length_m=12.0,
            lot_status="NEW",
            is_opened=False,
            storage_location="A-RACK-TTYPE-02",
            import_date=d,
            status="ACTIVE",
            note="dùng để demo chia nguồn PPF",
        ),
        dict(
            lot_id="LOT-MTYPE-001",
            material_code="M-TYPE",
            material_name="Phim PPF Climax M-TYPE",
            film_type="PPF",
            manufacturer="Climax",
            original_width_m=1.52,
            original_length_m=15.0,
            remaining_length_m=13.0,
            lot_status="NEW",
            is_opened=False,
            storage_location="A-RACK-MTYPE-01",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-RS20-001",
            material_code="RS20",
            material_name="Phim RS20",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=22.0,
            lot_status="IN_USE",
            is_opened=True,
            storage_location="A-RACK-RS20-01",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-DEMO-LOCKED-001",
            material_code="JB20",
            material_name="Phim JB20 — demo lock",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=10.0,
            lot_status="LOCKED",
            is_locked=True,
            locked_by_request_id="REQ-DEMO-LOCKED",
            is_opened=True,
            storage_location="A-RACK-DEMO-LOCK",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-DEMO-CLEARED-001",
            material_code="JB20",
            material_name="Phim JB20 — demo cleared",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=0.0,
            lot_status="CLEARED",
            is_locked=False,
            is_opened=True,
            storage_location="A-RACK-DEMO-CLEAR",
            import_date=d,
            status="ACTIVE",
        ),
        dict(
            lot_id="LOT-DEMO-DEPLETED-001",
            material_code="JB20",
            material_name="Phim JB20 — demo depleted",
            film_type="WINDOW_FILM",
            manufacturer="Konica",
            original_width_m=1.52,
            original_length_m=30.0,
            remaining_length_m=0.0,
            lot_status="DEPLETED",
            is_locked=False,
            is_opened=True,
            storage_location="A-RACK-DEMO-DEP",
            import_date=d,
            status="ACTIVE",
        ),
    ]
    for L in lots:
        _merge_lot(db, **L)


def seed_inventory_offcuts(db: Session) -> None:
    d = _today_date()
    def oc(**kw):
        w, l = float(kw.get("width_m", 0)), float(kw.get("length_m", 0))
        if "area_m2" not in kw or kw["area_m2"] is None:
            kw["area_m2"] = round(w * l, 3) if w and l else 0.0
        kw.setdefault("import_date", d)
        kw.setdefault("film_type", "WINDOW_FILM" if kw["material_code"] != "T-TYPE" else "PPF")
        kw.setdefault("quality_status", "GOOD")
        _merge_offcut(db, **kw)

    oc(
        offcut_id="SUBLOT-JB20-001",
        material_code="JB20",
        width_m=1.52,
        length_m=1.50,
        quality_status="GOOD",
        offcut_status="AVAILABLE",
        storage_location="OFFCUT-RACK-JB20-01",
    )
    oc(
        offcut_id="SUBLOT-JB20-002",
        material_code="JB20",
        width_m=1.52,
        length_m=0.80,
        quality_status="GOOD",
        offcut_status="AVAILABLE",
    )
    oc(
        offcut_id="SUBLOT-RT40-001",
        material_code="RT40",
        width_m=1.52,
        length_m=3.0,
        quality_status="GOOD",
        offcut_status="AVAILABLE",
    )
    oc(
        offcut_id="SUBLOT-TTYPE-001",
        material_code="T-TYPE",
        width_m=1.52,
        length_m=2.50,
        film_type="PPF",
        quality_status="GOOD",
        offcut_status="AVAILABLE",
    )
    oc(
        offcut_id="SUBLOT-DEMO-QUALITY-FAILED",
        material_code="JB20",
        width_m=1.52,
        length_m=0.6,
        quality_status="QUALITY_FAILED",
        offcut_status="QUALITY_FAILED",
    )
    oc(
        offcut_id="SUBLOT-DEMO-USED",
        material_code="JB20",
        width_m=1.52,
        length_m=0.5,
        quality_status="GOOD",
        offcut_status="USED",
    )
    oc(
        offcut_id="SUBLOT-DEMO-LOCKED",
        material_code="JB20",
        width_m=1.52,
        length_m=1.2,
        quality_status="GOOD",
        offcut_status="RESERVED",
        is_locked=True,
        locked_by_request_id="REQ-DEMO-LOCKED",
    )
    oc(
        offcut_id="SUBLOT-SEED-NEW-001",
        material_code="JB20",
        width_m=1.52,
        length_m=0.4,
        quality_status="GOOD",
        offcut_status="AVAILABLE",
        storage_location="OFFCUT-RACK-SEED",
    )


def seed_ocr_drafts(db: Session) -> None:
    upsert_lexus_ocr_drafts(db)


def _ppf_alloc_json(ws_id: str, ppf_type: str, sources: List[dict], change_reason: str) -> str:
    items = []
    for d in PPF_ITEM_DEFINITIONS:
        code = d["item_code"]
        sel = code == "FULL_VEHICLE_PPF"
        items.append(
            {
                "item_code": code,
                "item_name": d["item_name"],
                "is_selected": sel,
                "quantity": 1 if sel else 0,
                "planned_cut_block": DEFAULT_PPF_BLOCK if sel else "",
                "required_length_m": float(PPF_FULL_REQUIRED_M) if sel else 0.0,
                "sources": sources if sel else [],
            }
        )
    return json.dumps(
        {
            "workstream_id": ws_id,
            "workstream_type": "PPF_INSTALLATION",
            "ppf_type": ppf_type,
            "required_total_length_m": PPF_FULL_REQUIRED_M,
            "items": items,
            "change_reason": change_reason,
        },
        ensure_ascii=False,
    )


def _wf_alloc_demo_pending(ws_id: str = "WS-DEMO-WF-PENDING") -> str:
    from wf_allocation_service import WINDOW_FILM_JOB_TEMPLATE

    by_code = {
        "WINDSHIELD": ("RT40", "90x152", 90.0, 152.0, 1.52, [{"source_type": "LOT", "source_id": "LOT-RT40-001", "allocated_length_m": 1.52, "note": ""}]),
        "REAR_WINDOW": ("JB20", "50x130", 50.0, 130.0, 1.30, [{"source_type": "OFFCUT", "source_id": "SUBLOT-JB20-001", "allocated_length_m": 1.30, "note": ""}]),
        "FRONT_SIDE": ("JB20", "75x130", 75.0, 130.0, 1.30, [{"source_type": "LOT", "source_id": "LOT-JB20-001", "allocated_length_m": 1.30, "note": ""}]),
        "REAR_SIDE_TRIANGLE": ("JB20", "40x100", 40.0, 100.0, 1.0, [{"source_type": "LOT", "source_id": "LOT-JB20-001", "allocated_length_m": 1.0, "note": ""}]),
    }
    items = []
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        name = tmpl["item_name"]
        if ji in by_code:
            mc, sz, w, h, rm, srcs = by_code[ji]
            items.append(
                {
                    "item_code": ji,
                    "item_name": name,
                    "is_selected": True,
                    "quantity": 1,
                    "material_code": mc,
                    "planned_size": sz,
                    "required_width_cm": w,
                    "required_length_cm": h,
                    "required_length_m": rm,
                    "sources": srcs,
                }
            )
        else:
            items.append(
                {
                    "item_code": ji,
                    "item_name": name,
                    "is_selected": False,
                    "quantity": 0,
                    "material_code": "",
                    "planned_size": "",
                    "required_width_cm": 0.0,
                    "required_length_cm": 0.0,
                    "required_length_m": 0.0,
                    "sources": [],
                }
            )
    return json.dumps(
        {"workstream_id": ws_id, "workstream_type": "WINDOW_FILM_INSTALLATION", "items": items, "change_reason": ""},
        ensure_ascii=False,
    )


def _merge_request(db: Session, **kw) -> DbRequest:
    rid = kw["request_id"]
    row = db.query(DbRequest).filter(DbRequest.request_id == rid).first()
    if not row:
        row = DbRequest(request_id=rid, dealer_id=kw.get("dealer_id") or "")
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    return row


def _merge_ws(db: Session, **kw) -> DbWorkstream:
    wid = kw["workstream_id"]
    row = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == wid).first()
    if not row:
        row = DbWorkstream(workstream_id=wid, request_id=kw["request_id"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)
    return row


def _merge_job(db: Session, **kw) -> None:
    jid = kw["job_card_id"]
    row = db.query(DbJobCard).filter(DbJobCard.job_card_id == jid).first()
    if not row:
        row = DbJobCard(job_card_id=jid, request_id=kw["request_id"])
        db.add(row)
    for k, v in kw.items():
        if hasattr(row, k) and v is not None:
            setattr(row, k, v)


def seed_requests_and_workstreams(db: Session) -> None:
    ts = _now_iso()
    svc_both = json.dumps(
        {"include_ppf": True, "include_window_film": True, "window_film_items": ["WINDSHIELD", "REAR_WINDOW", "FRONT_SIDE", "REAR_SIDE_TRIANGLE"]},
        ensure_ascii=False,
    )
    wf_plan = json.dumps(
        [
            {"job_item": "WINDSHIELD", "material_code": "RT40", "size": "90x152", "width_cm": 90, "length_cm": 152},
            {"job_item": "REAR_WINDOW", "material_code": "JB20", "size": "50x130", "width_cm": 50, "length_cm": 130},
            {"job_item": "FRONT_SIDE", "material_code": "JB20", "size": "75x130", "width_cm": 75, "length_cm": 130},
            {"job_item": "REAR_SIDE_TRIANGLE", "material_code": "JB20", "size": "40x100", "width_cm": 40, "length_cm": 100},
        ],
        ensure_ascii=False,
    )

    # Stub cho LOT/OFFCUT lock demo
    _merge_request(
        db,
        request_id="REQ-DEMO-LOCKED",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        customer_name="Nguyễn Văn An",
        vehicle_id="VEH-RX350-DEMO",
        vin_masked="JTJBARBZ8N0123456",
        vehicle_model_code="RX350",
        status="ALLOCATED",
        is_multi_workstream=False,
        source_channel="MANUAL",
        created_at=ts,
        service_selection_json=svc_both,
    )

    # A — chờ duyệt PPF + WF
    ppf_sources = [
        {"source_type": "LOT", "source_id": "LOT-TTYPE-001", "allocated_length_m": 7.2, "note": ""},
        {"source_type": "LOT", "source_id": "LOT-TTYPE-002", "allocated_length_m": 5.8, "note": ""},
    ]
    _merge_request(
        db,
        request_id="REQ-DEMO-PENDING-PPF-WF",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        customer_name="Nguyễn Văn An",
        vehicle_id="VEH-RX350-DEMO",
        vin_masked="JTJBARBZ8N0123456",
        vehicle_model_code="RX350",
        material_code="T-TYPE",
        job_items="WINDSHIELD;REAR_WINDOW;FRONT_SIDE;REAR_SIDE_TRIANGLE",
        status="ALLOCATED",
        is_multi_workstream=True,
        source_channel="MANUAL",
        requested_delivery_time="2026-06-10T16:00:00+07:00",
        created_at=ts,
        service_selection_json=svc_both,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-PPF-PENDING",
        request_id="REQ-DEMO-PENDING-PPF-WF",
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        technician_team="PPF_TEAM_A",
        selected_material_code="T-TYPE",
        material_plan=None,
        status="PENDING_APPROVAL",
        ppf_allocation_json=_ppf_alloc_json(
            "WS-DEMO-PPF-PENDING",
            "T-TYPE",
            ppf_sources,
            "LOT đầu không đủ 13m, chia thêm LOT mới.",
        ),
        ppf_type_change_reason="LOT đầu không đủ 13m, chia thêm LOT mới.",
        created_at=ts,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-WF-PENDING",
        request_id="REQ-DEMO-PENDING-PPF-WF",
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        technician_team="WINDOW_FILM_TEAM_B",
        selected_material_code="JB20",
        material_plan=wf_plan,
        status="PENDING_APPROVAL",
        wf_allocation_json=_wf_alloc_demo_pending("WS-DEMO-WF-PENDING"),
        created_at=ts,
    )

    # B — IN_PROGRESS
    _merge_request(
        db,
        request_id="REQ-DEMO-IN-PROGRESS",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        vehicle_id="VEH-RX350-DEMO",
        vehicle_model_code="RX350",
        status="IN_PROGRESS",
        is_multi_workstream=True,
        source_channel="MANUAL",
        requested_delivery_time="2026-06-08T17:00:00+07:00",
        created_at=ts,
        service_selection_json=svc_both,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-PPF-INPROG",
        request_id="REQ-DEMO-IN-PROGRESS",
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        selected_material_code="T-TYPE",
        status="IN_PROGRESS",
        ppf_allocation_json=_ppf_alloc_json("WS-DEMO-PPF-INPROG", "T-TYPE", ppf_sources[:1], ""),
        started_at=ts,
        created_at=ts,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-WF-INPROG",
        request_id="REQ-DEMO-IN-PROGRESS",
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        selected_material_code="JB20",
        material_plan=wf_plan,
        status="ASSIGNED_TO_TECHNICIAN",
        wf_allocation_json=_wf_alloc_demo_pending("WS-DEMO-WF-INPROG"),
        created_at=ts,
    )

    # C — PARTIALLY_COMPLETED
    _merge_request(
        db,
        request_id="REQ-DEMO-PARTIAL",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        vehicle_id="VEH-RX350-DEMO",
        vehicle_model_code="RX350",
        status="PARTIALLY_COMPLETED",
        is_multi_workstream=True,
        source_channel="MANUAL",
        created_at=ts,
        service_selection_json=svc_both,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-PARTIAL-PPF",
        request_id="REQ-DEMO-PARTIAL",
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        selected_material_code="T-TYPE",
        status="CLOSED",
        inventory_committed=True,
        ppf_allocation_json=_ppf_alloc_json("WS-DEMO-PARTIAL-PPF", "T-TYPE", ppf_sources[:1], ""),
        closed_at=ts,
        created_at=ts,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-PARTIAL-WF",
        request_id="REQ-DEMO-PARTIAL",
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        selected_material_code="JB20",
        material_plan=wf_plan,
        status="IN_PROGRESS",
        wf_allocation_json=_wf_alloc_demo_pending("WS-DEMO-PARTIAL-WF"),
        created_at=ts,
    )

    # D — CLOSED
    _merge_request(
        db,
        request_id="REQ-DEMO-CLOSED",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        vehicle_id="VEH-RX350-DEMO",
        vehicle_model_code="RX350",
        status="CLOSED",
        is_multi_workstream=True,
        source_channel="MANUAL",
        created_at=ts,
        service_selection_json=svc_both,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-PPF-CLOSED",
        request_id="REQ-DEMO-CLOSED",
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        selected_material_code="T-TYPE",
        status="CLOSED",
        inventory_committed=True,
        ppf_allocation_json=_ppf_alloc_json("WS-DEMO-PPF-CLOSED", "T-TYPE", ppf_sources, ""),
        closed_at=ts,
        created_at=ts,
    )
    _merge_ws(
        db,
        workstream_id="WS-DEMO-WF-CLOSED",
        request_id="REQ-DEMO-CLOSED",
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        selected_material_code="JB20",
        material_plan=wf_plan,
        status="CLOSED",
        inventory_committed=True,
        wf_allocation_json=_wf_alloc_demo_pending("WS-DEMO-WF-CLOSED"),
        closed_at=ts,
        created_at=ts,
    )

    # E — NEEDS_REVIEW
    warn_e = json.dumps({"warnings": ["MISSING_VEHICLE_NORM", "MISSING_MATERIAL_PREFERENCE"]}, ensure_ascii=False)
    _merge_request(
        db,
        request_id="REQ-DEMO-NEEDS-REVIEW",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        vehicle_id="VEH-UNKNOWN-MODEL",
        vehicle_model_code="UNKNOWN_MODEL",
        status="NEEDS_REVIEW",
        is_multi_workstream=False,
        source_channel="MANUAL",
        created_at=ts,
        norm_application_json=warn_e,
        exception_reason="Thiếu định mức / Material preference cho UNKNOWN_MODEL",
    )

    # F — EXCEPTION_HOLD
    _merge_request(
        db,
        request_id="REQ-DEMO-EXCEPTION-HOLD",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUS-DIRECT-001",
        vehicle_id="VEH-RX350-DEMO",
        vehicle_model_code="RX350",
        status="EXCEPTION_HOLD",
        is_multi_workstream=True,
        source_channel="MANUAL",
        created_at=ts,
        service_selection_json=svc_both,
        exception_reason=json.dumps({"warnings": ["SOURCE_CLEARED_OR_INVALID", "NEED_MANAGER_REVIEW"]}, ensure_ascii=False),
    )


def seed_job_cards(db: Session) -> None:
    ts = _now_iso()
    ago = (datetime.datetime.utcnow() - datetime.timedelta(minutes=30)).isoformat() + "Z"
    _merge_job(
        db,
        job_card_id="JOB-DEMO-PPF-PENDING",
        request_id="REQ-DEMO-PENDING-PPF-WF",
        workstream_id="WS-DEMO-PPF-PENDING",
        workstream_type="PPF_INSTALLATION",
        technician_id="KTV-PPF-01",
        technician_name="KTV PPF 01",
        technician_team="PPF_TEAM_A",
        vehicle_model_code="RX350",
        material_code="T-TYPE",
        status="PENDING",
        created_at=ts,
    )
    _merge_job(
        db,
        job_card_id="JOB-DEMO-WF-PENDING",
        request_id="REQ-DEMO-PENDING-PPF-WF",
        workstream_id="WS-DEMO-WF-PENDING",
        workstream_type="WINDOW_FILM_INSTALLATION",
        technician_id="KTV-WF-01",
        technician_name="KTV WF 01",
        technician_team="WINDOW_FILM_TEAM_B",
        vehicle_model_code="RX350",
        material_code="JB20",
        status="PENDING",
        created_at=ts,
    )
    _merge_job(
        db,
        job_card_id="JOB-DEMO-PPF-INPROG",
        request_id="REQ-DEMO-IN-PROGRESS",
        workstream_id="WS-DEMO-PPF-INPROG",
        workstream_type="PPF_INSTALLATION",
        technician_id="KTV-PPF-02",
        technician_team="PPF_TEAM_A",
        vehicle_model_code="RX350",
        material_code="T-TYPE",
        status="IN_PROGRESS",
        started_at=ago,
        created_at=ts,
    )
    _merge_job(
        db,
        job_card_id="JOB-DEMO-WF-INPROG",
        request_id="REQ-DEMO-IN-PROGRESS",
        workstream_id="WS-DEMO-WF-INPROG",
        workstream_type="WINDOW_FILM_INSTALLATION",
        technician_id="KTV-WF-02",
        technician_team="WINDOW_FILM_TEAM_B",
        vehicle_model_code="RX350",
        material_code="JB20",
        status="PENDING",
        created_at=ts,
    )
    _merge_job(
        db,
        job_card_id="JOB-DEMO-PPF-CLOSED",
        request_id="REQ-DEMO-CLOSED",
        workstream_id="WS-DEMO-PPF-CLOSED",
        workstream_type="PPF_INSTALLATION",
        technician_id="KTV-PPF-03",
        technician_team="PPF_TEAM_A",
        vehicle_model_code="RX350",
        material_code="T-TYPE",
        status="COMPLETED_BY_TECHNICIAN",
        started_at=ts,
        completed_at=ts,
        actual_confirmation_status="COMPLETED",
        created_at=ts,
    )
    _merge_job(
        db,
        job_card_id="JOB-DEMO-WF-CLOSED",
        request_id="REQ-DEMO-CLOSED",
        workstream_id="WS-DEMO-WF-CLOSED",
        workstream_type="WINDOW_FILM_INSTALLATION",
        technician_id="KTV-WF-03",
        technician_team="WINDOW_FILM_TEAM_B",
        vehicle_model_code="RX350",
        material_code="JB20",
        status="COMPLETED_BY_TECHNICIAN",
        started_at=ts,
        completed_at=ts,
        actual_confirmation_status="COMPLETED",
        created_at=ts,
    )
    # Liên kết job vào workstream
    for wid, jid in (
        ("WS-DEMO-PPF-PENDING", "JOB-DEMO-PPF-PENDING"),
        ("WS-DEMO-WF-PENDING", "JOB-DEMO-WF-PENDING"),
        ("WS-DEMO-PPF-INPROG", "JOB-DEMO-PPF-INPROG"),
        ("WS-DEMO-WF-INPROG", "JOB-DEMO-WF-INPROG"),
        ("WS-DEMO-PPF-CLOSED", "JOB-DEMO-PPF-CLOSED"),
        ("WS-DEMO-WF-CLOSED", "JOB-DEMO-WF-CLOSED"),
    ):
        ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == wid).first()
        if ws:
            ws.job_card_id = jid


def seed_inventory_transactions(db: Session) -> None:
    ts = _now_iso()
    rid_closed = "REQ-DEMO-CLOSED"
    rid_partial = "REQ-DEMO-PARTIAL"

    def add_txn(tid: str, ttype: str, src_type: str, src_id: str, mc: str, **extra):
        row = db.query(DbInventoryTransaction).filter(DbInventoryTransaction.transaction_id == tid).first()
        if row:
            return
        db.add(
            DbInventoryTransaction(
                transaction_id=tid,
                transaction_type=ttype,
                source_type=src_type,
                source_id=src_id,
                material_code=mc,
                material_name=extra.get("material_name"),
                width_m=extra.get("width_m", 1.52),
                length_m=extra.get("length_m"),
                quantity_m=extra.get("quantity_m"),
                balance_unit=extra.get("balance_unit", "METER"),
                before_balance=extra.get("before_balance"),
                after_balance=extra.get("after_balance"),
                before_status=extra.get("before_status"),
                after_status=extra.get("after_status"),
                reason=extra.get("reason", "standard_seed"),
                related_request_id=extra.get("related_request_id"),
                related_workstream_id=extra.get("related_workstream_id"),
                performed_by=extra.get("performed_by", "SEED-SYSTEM"),
                performed_role=extra.get("performed_role", "ADMIN"),
                performed_at=ts,
                channel="WEB",
                note=extra.get("note"),
            )
        )

    add_txn(
        "INV-SEED-IMPORT-LOT-001",
        "IMPORT_LOT",
        "LOT",
        "LOT-RT40-001",
        "RT40",
        length_m=30.0,
        quantity_m=30.0,
        before_balance=0.0,
        after_balance=30.0,
        reason="Nhập LOT seed",
    )
    add_txn(
        "INV-SEED-IMPORT-OFFCUT-001",
        "IMPORT_OFFCUT_MANUAL",
        "OFFCUT",
        "SUBLOT-JB20-001",
        "JB20",
        length_m=1.5,
        quantity_m=2.28,
        balance_unit="SQUARE_METER",
        reason="Nhập mảnh dư seed",
    )
    add_txn(
        "INV-SEED-ISSUE-LOT-PPF-CLOSED",
        "ISSUE_FROM_LOT",
        "LOT",
        "LOT-TTYPE-002",
        "T-TYPE",
        length_m=2.0,
        quantity_m=2.0,
        before_balance=14.0,
        after_balance=12.0,
        related_request_id=rid_closed,
        related_workstream_id="WS-DEMO-PPF-CLOSED",
        reason="Xuất PPF đơn CLOSED (ledger khớp tồn LOT-TTYPE-002)",
    )
    add_txn(
        "INV-SEED-ISSUE-LOT-WF-CLOSED",
        "ISSUE_FROM_LOT",
        "LOT",
        "LOT-JB20-001",
        "JB20",
        length_m=3.0,
        quantity_m=3.0,
        before_balance=30.0,
        after_balance=27.0,
        related_request_id=rid_closed,
        related_workstream_id="WS-DEMO-WF-CLOSED",
        reason="Xuất WF đơn CLOSED",
    )
    add_txn(
        "INV-SEED-ISSUE-LOT-RT40-WF",
        "ISSUE_FROM_LOT",
        "LOT",
        "LOT-RT40-002",
        "RT40",
        length_m=0.5,
        quantity_m=0.5,
        before_balance=18.5,
        after_balance=18.0,
        related_request_id=rid_closed,
        related_workstream_id="WS-DEMO-WF-CLOSED",
        reason="Xuất kính lái RT40",
    )
    add_txn(
        "INV-SEED-CREATE-OFFCUT",
        "CREATE_OFFCUT",
        "OFFCUT",
        "SUBLOT-SEED-NEW-001",
        "JB20",
        length_m=0.4,
        quantity_m=0.6,
        balance_unit="SQUARE_METER",
        related_request_id=rid_closed,
        reason="Tạo mảnh dư sau cắt",
    )
    add_txn(
        "INV-SEED-ISSUE-OFFCUT-DEMO",
        "ISSUE_FROM_OFFCUT",
        "OFFCUT",
        "SUBLOT-JB20-002",
        "JB20",
        length_m=0.05,
        quantity_m=0.076,
        balance_unit="SQUARE_METER",
        before_balance=1.292,
        after_balance=1.216,
        related_request_id=rid_closed,
        related_workstream_id="WS-DEMO-WF-CLOSED",
        reason="Xuất mảnh dư WF (demo nhỏ, khớp tồn SUBLOT-JB20-002)",
    )
    add_txn(
        "INV-SEED-SCRAP",
        "RECORD_SCRAP",
        "LOT",
        "LOT-JB20-002",
        "JB20",
        length_m=0.1,
        quantity_m=0.1,
        related_request_id=rid_closed,
        reason="Ghi nhận phế",
    )
    add_txn(
        "INV-SEED-RELEASE-LOCK",
        "RELEASE_LOCK",
        "LOT",
        "LOT-DEMO-LOCKED-001",
        "JB20",
        related_request_id="REQ-DEMO-LOCKED",
        before_status="LOCKED",
        after_status="LOCKED",
        reason="Demo release lock ledger (LOT demo lock)",
    )
    add_txn(
        "INV-SEED-CLEAR-LOT",
        "CLEAR_LOT",
        "LOT",
        "LOT-DEMO-CLEARED-001",
        "JB20",
        after_status="CLEARED",
        reason="Clear LOT demo",
    )
    add_txn(
        "INV-SEED-CLEAR-OFFCUT",
        "CLEAR_OFFCUT",
        "OFFCUT",
        "SUBLOT-DEMO-USED",
        "JB20",
        balance_unit="SQUARE_METER",
        reason="Clear offcut demo",
    )
    add_txn(
        "INV-SEED-MANUAL-ISSUE",
        "MANUAL_ISSUE_LOT",
        "LOT",
        "LOT-RS20-001",
        "RS20",
        length_m=0.5,
        quantity_m=0.5,
        before_balance=22.0,
        after_balance=21.5,
        reason="Xuất thủ công demo",
    )
    add_txn(
        "INV-SEED-RELEASE-MANUAL",
        "RELEASE_LOCK_MANUAL",
        "LOT",
        "LOT-DEMO-LOCKED-001",
        "JB20",
        related_request_id="REQ-DEMO-LOCKED",
        reason="Release lock manual demo",
    )
    add_txn(
        "INV-SEED-ISSUE-PARTIAL-PPF",
        "ISSUE_FROM_LOT",
        "LOT",
        "LOT-TTYPE-002",
        "T-TYPE",
        length_m=1.0,
        quantity_m=1.0,
        before_balance=15.0,
        after_balance=14.0,
        related_request_id=rid_partial,
        related_workstream_id="WS-DEMO-PARTIAL-PPF",
        reason="PPF partial commit demo",
    )


def seed_audit_logs(db: Session) -> None:
    ts = _now_iso()
    events = [
        ("DATABASE_RESET_SEEDED", None, "SYSTEM", "Chuẩn hóa seed demo"),
        ("DEALER_CREATED", None, "ADMIN", "DEALER_LEXUS_SG"),
        ("CUSTOMER_CREATED", None, "ADMIN", "CUS-DIRECT-001"),
        ("VEHICLE_CREATED", None, "ADMIN", "VEH-RX350-DEMO"),
        ("OCR_DRAFT_CREATED", None, "OCR", "OCR-DRAFT-LEXUS-115-NEW"),
        ("REQUEST_CREATED_FROM_IMAGE", "REQ-TEST-LEXUS-115", "ADMIN", ""),
        ("REQUEST_MANUAL_CREATED", "REQ-DEMO-PENDING-PPF-WF", "ADMIN", ""),
        ("WORKSTREAM_CREATED", "REQ-DEMO-PENDING-PPF-WF", "ADMIN", "WS-DEMO-PPF-PENDING"),
        ("WORKSTREAM_ALLOCATION_UPDATED", "REQ-DEMO-PENDING-PPF-WF", "ADMIN", "WF allocation"),
        ("WORKSTREAM_APPROVED", "REQ-DEMO-CLOSED", "MGR", "WS-DEMO-PPF-CLOSED"),
        ("SOFT_LOCK_RECORDED", "REQ-DEMO-PENDING-PPF-WF", "SYSTEM", "LOT soft lock"),
        ("JOB_ASSIGNED", "REQ-DEMO-IN-PROGRESS", "DISPATCH", "JOB-DEMO-PPF-INPROG"),
        ("JOB_STARTED", "REQ-DEMO-IN-PROGRESS", "KTV", "JOB-DEMO-PPF-INPROG"),
        ("MOBILE_TECH_CONFIRMED", "REQ-DEMO-CLOSED", "KTV", "mobile"),
        ("JOB_COMPLETED_BY_TECH", "REQ-DEMO-CLOSED", "KTV", "JOB-DEMO-WF-CLOSED"),
        ("INVENTORY_COMMITTED", "REQ-DEMO-CLOSED", "SYSTEM", "committed"),
        ("REQUEST_CLOSED", "REQ-DEMO-CLOSED", "SYSTEM", "closed"),
        ("MATERIAL_PREFERENCE_CREATED", None, "ADMIN", "MATPREF-WINDSHIELD"),
        ("VEHICLE_NORM_CREATED", None, "ADMIN", "NORM-STANDARD-RX350-2020-2026"),
        ("LOT_IMPORTED", None, "ADMIN", "LOT-RT40-001"),
        ("OFFCUT_IMPORTED_MANUAL", None, "ADMIN", "SUBLOT-JB20-001"),
        ("LOT_CLEARED", None, "ADMIN", "LOT-DEMO-CLEARED-001"),
        ("OFFCUT_CLEARED", None, "ADMIN", "SUBLOT-DEMO-USED"),
    ]
    for ev, rid, actor, note in events:
        lid = f"AUD-STD-{ev}"
        row = db.query(DbAuditLog).filter(DbAuditLog.log_id == lid).first()
        if row:
            continue
        db.add(
            DbAuditLog(
                log_id=lid,
                request_id=rid,
                transaction_type=ev,
                transaction_status="OK",
                actor=actor,
                timestamp=ts,
                reason=note,
            )
        )


def seed_dashboard_demo_data(db: Session) -> None:
    ts = _now_iso()
    nid = "NOTIF-SEED-DASH-001"
    row = db.query(DbNotification).filter(DbNotification.notif_id == nid).first()
    if not row:
        db.add(
            DbNotification(
                notif_id=nid,
                title="Dữ liệu demo đã chuẩn hóa",
                body="Database standard seed — kiểm tra các tab Tổng quan, OCR, Đơn hàng.",
                notif_type="INFO",
                related_id="SYSTEM",
                related_type="SEED",
                recipient_role="ADMIN",
                is_read=False,
                created_at=ts,
            )
        )


def _seed_cutting_group_matrix(db: Session) -> None:
    web_demo = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(web_demo)
    cg_path = os.path.join(root, "knowledge", "cutting_group_matrix.csv")
    if not os.path.isfile(cg_path):
        return
    import csv

    db.query(DbCuttingGroupMatrix).delete(synchronize_session=False)
    with open(cg_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            db.add(
                DbCuttingGroupMatrix(
                    cut_group_id=row["cut_group_id"],
                    vehicle_model_code=row["vehicle_model_code"],
                    model_year=int(row["model_year"]),
                    film_type=row["film_type"],
                    material_code=row["material_code"],
                    job_items=row["job_items"],
                    piece_sizes=row["piece_sizes"],
                    roll_width_cm=int(row["roll_width_cm"]),
                    cut_block_width_cm=int(row["cut_block_width_cm"]),
                    cut_block_length_cm=int(row["cut_block_length_cm"]),
                    deduction_length_m=float(row["deduction_length_m"]),
                    deduction_area_m2=float(row["deduction_area_m2"]),
                    grouping_rule=row["grouping_rule"],
                    status=row["status"],
                )
            )


def try_location_master_import_warn_only() -> None:
    import logging

    log = logging.getLogger("uvicorn.error")
    web_demo = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(web_demo, "data", "Danh-muc-Phuong-xa_moi.csv")
    json_path = os.path.join(web_demo, "static", "location_master.json")
    if os.path.isfile(json_path):
        return
    if not os.path.isfile(csv_path):
        log.warning("[standard_seed] Không có location_master.json và thiếu CSV — bỏ qua import địa bàn.")
        return
    try:
        from location_master_import import run_import

        run_import(csv_path, json_path)
    except Exception as e:
        log.warning("[standard_seed] location_master_import: %s", e)


def seed_req_20260604_for_inventory_smokes(db: Session) -> None:
    """
    Đơn + workstream legacy dùng inventory_admin_smoke_test / manual_order validate-sources.
    Cần LOT-LEX-CO-TTYPE-* từ _ensure_five_lots_per_material.
    """
    ts = _now_iso()
    _merge_customer(
        db,
        customer_id="CUST_001",
        customer_name="Đỗ Minh Khang",
        customer_masked="Đỗ Minh Khang",
        phone="0909888777",
        phone_masked="0909888777",
        address="220 Võ Văn Tần, Phường 5, Quận 3, TP.HCM",
        address_masked="220 Võ Văn Tần, Phường 5, Quận 3, TP.HCM",
        full_address="220 Võ Văn Tần, Phường 5, Quận 3, TP.HCM",
        status="ACTIVE",
        created_at=ts,
    )
    _merge_vehicle(
        db,
        vehicle_id="VEH_001",
        customer_id="CUST_001",
        dealer_id="DEALER_LEXUS_SG",
        vehicle_model_code="LEXUS_RX350",
        model_year=2026,
        vin_number="JTJBARBZ7N5123456",
        vin_masked="JTJBARBZ7N5123456",
        vehicle_status="ACTIVE",
        created_at=ts,
    )
    wf_plan = json.dumps(
        [
            {"job_item": "WINDSHIELD", "material_code": "RT40", "note": "Kính lái"},
            {"job_item": "REAR_WINDOW", "material_code": "JB20"},
            {"job_item": "FRONT_SIDE", "material_code": "JB20"},
            {"job_item": "REAR_SIDE_TRIANGLE", "material_code": "JB20"},
            {"job_item": "SUNROOF", "material_code": "JB20"},
        ],
        ensure_ascii=False,
    )
    _merge_request(
        db,
        request_id="REQ-20260604-001",
        dealer_id="DEALER_LEXUS_SG",
        customer_id="CUST_001",
        customer_name="Đỗ Minh Khang",
        vehicle_id="VEH_001",
        vin_number="JTJBARBZ7N5123456",
        vin_masked="JTJBARBZ7N5123456",
        vehicle_model_code="LEXUS_RX350",
        material_code="JB20",
        job_items="PPF_FULL;WINDSHIELD;REAR_WINDOW;FRONT_SIDE;REAR_SIDE_TRIANGLE;SUNROOF",
        status="ALLOCATED",
        is_grouped_cut=True,
        cut_group_id="CG_RX350_SIDE_REAR",
        planned_cut_block="152x143",
        planned_deduction_length_m=1.43,
        allocated_source_type="LOT",
        allocated_source_id="LOT-JB20-001",
        is_multi_workstream=True,
        requested_delivery_time="2026-06-04T10:30:00Z",
        created_at="2026-06-04T01:00:00",
        source_channel="OCR",
    )
    lot_ppf = (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == "T-TYPE", DbLotInventory.lot_id.like("LOT-LEX-CO-TTYPE-%"))
        .order_by(DbLotInventory.lot_id)
        .first()
    )
    ppf_lot_id = (lot_ppf.lot_id if lot_ppf else "LOT-TTYPE-002")
    _merge_ws(
        db,
        workstream_id="WS-PPF-20260604-001",
        request_id="REQ-20260604-001",
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        technician_team="PPF_TEAM_A",
        assigned_technician_id="KTV-PPF-001",
        assigned_technician_name="Tran Van Binh",
        selected_material_code="T-TYPE",
        planned_cut_block="152x1300",
        planned_deduction_length_m=13.0,
        allocated_source_type="LOT",
        allocated_source_id=ppf_lot_id,
        status="PENDING_APPROVAL",
        actual_confirmation_status="PENDING",
        created_at=ts,
    )
    _merge_ws(
        db,
        workstream_id="WS-WF-20260604-001",
        request_id="REQ-20260604-001",
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        technician_team="WINDOW_FILM_TEAM_B",
        assigned_technician_id="KTV-003",
        assigned_technician_name="Nguyen Van An",
        selected_material_code="JB20",
        material_plan=wf_plan,
        cut_group_id="CG_RX350_SIDE_REAR",
        planned_cut_block="152x143",
        planned_deduction_length_m=1.43,
        allocated_source_type="LOT",
        allocated_source_id="LOT-JB20-001",
        status="PENDING_APPROVAL",
        actual_confirmation_status="PENDING",
        created_at=ts,
    )


def seed_all_demo_data(db: Session) -> Dict[str, Any]:
    """Seed toàn bộ; gọi trong transaction — caller commit/rollback."""
    out: Dict[str, Any] = {}
    seed_dealers(db)
    seed_end_customers(db)
    seed_vehicle_profiles(db)
    out["film_norm_import"] = seed_vehicle_film_norms(db)
    seed_material_preferences(db)
    seed_inventory_lots(db)
    seed_inventory_offcuts(db)
    seed_ocr_drafts(db)
    seed_requests_and_workstreams(db)
    seed_job_cards(db)
    seed_inventory_transactions(db)
    seed_audit_logs(db)
    seed_dashboard_demo_data(db)
    _seed_cutting_group_matrix(db)
    from populate_db import _ensure_five_lots_per_material

    _ensure_five_lots_per_material(db)
    # Bắt buộc flush: LOT-LEX-CO-* mới add là pending — query chọn PPF lot sẽ không thấy nếu chưa flush
    # (fallback LOT-TTYPE-002 chỉ còn 12m < 13m → validate-sources REQ-20260604-001 ERROR).
    db.flush()
    seed_req_20260604_for_inventory_smokes(db)
    return out


def summarize_table_counts(db: Session) -> Dict[str, int]:
    from database import DbOcrDraft

    def cnt(model):
        return int(db.query(model).count())

    return {
        "dealers": cnt(DbDealer),
        "customers": cnt(DbCustomer),
        "vehicle_profiles": cnt(DbVehicleProfile),
        "vehicle_film_norms": cnt(DbVehicleFilmNorm),
        "material_preferences": cnt(DbMaterialPreference),
        "lot_inventory": cnt(DbLotInventory),
        "offcut_inventory": cnt(DbOffcutInventory),
        "ocr_drafts": cnt(DbOcrDraft),
        "requests": cnt(DbRequest),
        "workstreams": cnt(DbWorkstream),
        "job_cards": cnt(DbJobCard),
        "inventory_transactions": cnt(DbInventoryTransaction),
        "audit_logs": cnt(DbAuditLog),
        "notifications": cnt(DbNotification),
    }


def seed_all_demo_data_if_missing_canonical(db: Session) -> bool:
    """Startup: seed đầy đủ chỉ khi DB hoàn toàn trống (chưa có dealer)."""
    if db.query(DbDealer).count() > 0:
        return False
    seed_all_demo_data(db)
    return True
