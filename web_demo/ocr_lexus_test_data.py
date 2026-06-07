# -*- coding: utf-8 -*-
"""Dữ liệu OCR test 2 phiếu Lexus — draft cố định + confirm tạo REQ-TEST-LEXUS-* (WF only)."""
from __future__ import annotations

import datetime
import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import (
    DbCustomer,
    DbDealer,
    DbOcrDraft,
    DbRequest,
    DbVehicleProfile,
    DbWorkstream,
)
from vehicle_norm_logic import (
    apply_auto_fill_to_plan,
    normalize_vehicle_model_code,
    resolve_vehicle_norm_with_year_fallback,
)
from customer_api import (
    _add_notif,
    _audit,
    _hydrate_wf_plan_material_preferences,
    _material_plan_for_items,
    _pick_lot_for_material,
    _pick_offcut_for_material,
    _wf_cut_group,
)


def _uid(s: str = "") -> str:
    return f"{s}{uuid.uuid4().hex[:8].upper()}"


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


LEXUS_OCR_DRAFT_IDS = frozenset({"OCR-DRAFT-LEXUS-115-NEW", "OCR-DRAFT-LEXUS-117-NEW"})

LEXUS_TEST_REQUEST_BY_DRAFT = {
    "OCR-DRAFT-LEXUS-115-NEW": "REQ-TEST-LEXUS-115",
    "OCR-DRAFT-LEXUS-117-NEW": "REQ-TEST-LEXUS-117",
}

LEXUS_CUSTOMER_SUFFIX = {
    "OCR-DRAFT-LEXUS-115-NEW": "115",
    "OCR-DRAFT-LEXUS-117-NEW": "117",
}


def is_lexus_test_draft_id(draft_id: str) -> bool:
    return (draft_id or "").strip() in LEXUS_OCR_DRAFT_IDS


def _lexus_payload(draft_id: str) -> dict:
    if draft_id == "OCR-DRAFT-LEXUS-115-NEW":
        return {
            "ocr_draft_id": "OCR-DRAFT-LEXUS-115-NEW",
            "source_file_name": "115-69008-29042026.jpg",
            "source_channel": "OCR_IMAGE",
            "dealer_id": "DEALER_LEXUS_SG",
            "dealer_name": "LEXUS TRUNG TÂM SÀI GÒN – Công Ty TNHH Ôtô Toyotsu Samco",
            "request_no": "01.2600104",
            "request_date": "2026-04-20",
            "contract_no": "0844/HDKT/2025/LX600",
            "customer_name": "LÊ THANH PHƯƠNG",
            "customer_masked": "LÊ THANH PHƯƠNG",
            "customer_phone": "",
            "customer_address": "Ô 1B, DC 19, Khu phố 4, Phường An Phú, Thành phố Hồ Chí Minh.",
            "address_masked": "Ô 1B, DC 19, Khu phố 4, Phường An Phú, Thành phố Hồ Chí Minh.",
            "sales_consultant": "NGUYỄN QUANG BẢO",
            "vehicle_model_code": "LX600",
            "model_name": "LX600 URBAN",
            "vin_number": "JTJPB7CX304095170",
            "vin_masked": "JTJPB7CX304095170",
            "frame_no_masked": "JTJPB7CX304095170",
            "requested_delivery_at": "2026-04-27T00:00:00+07:00",
            "item_code": "PPFLX",
            "item_description": "Dán phim PPF cho xe lexus lx; Phim cách nhiệt konica xe lx",
            "quantity": 1,
            "unit": "Bộ",
            "amount": 164376000,
            "service_selection": {
                "include_ppf": True,
                "include_window_film": True,
                "window_film_items": [
                    "WINDSHIELD",
                    "REAR_WINDOW",
                    "FRONT_SIDE",
                    "REAR_SIDE",
                ],
            },
            "review_status": "NEEDS_REVIEW",
            "ocr_status": "COMPLETED",
            "confidence_score": 0.96,
            "note": "Dữ liệu mẫu từ phiếu LÊ THANH PHƯƠNG (LX600).",
        }
    if draft_id == "OCR-DRAFT-LEXUS-117-NEW":
        return {
            "ocr_draft_id": "OCR-DRAFT-LEXUS-117-NEW",
            "source_file_name": "117-69069-10052026.jpg",
            "source_channel": "OCR_IMAGE",
            "dealer_id": "DEALER_LEXUS_SG",
            "dealer_name": "LEXUS TRUNG TÂM SÀI GÒN – Công Ty TNHH Ôtô Toyotsu Samco",
            "request_no": "01.2600117",
            "request_date": "2026-04-24",
            "contract_no": "0350/HDKT/2026/RX350H PRE",
            "customer_name": "Lê Hoàng Nam",
            "customer_masked": "Lê Hoàng Nam",
            "customer_phone": "0918765432",
            "customer_address": "120 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM",
            "address_masked": "120 Pasteur, Phường Bến Nghé, Quận 1, TP.HCM",
            "sales_consultant": "Trần Văn Minh",
            "vehicle_model_code": "RX350",
            "model_name": "RX350H PREMIUM CE",
            "vin_number": "JTJBARBZ6N2012346",
            "vin_masked": "JTJBARBZ6N2012346",
            "frame_no_masked": "JTJBARBZ6N2012346",
            "requested_delivery_at": "2026-06-06T10:00:00+07:00",
            "item_code": "ACCRX00001PK",
            "item_description": "Phim cách nhiệt Konica xe Lexus RX",
            "quantity": 1,
            "unit": "Bộ",
            "amount": 22734000,
            "service_selection": {
                "include_ppf": False,
                "include_window_film": True,
                "window_film_items": [
                    "WINDSHIELD",
                    "REAR_WINDOW",
                    "FRONT_SIDE",
                    "REAR_SIDE_TRIANGLE",
                    "SUNROOF",
                ],
            },
            "review_status": "NEEDS_REVIEW",
            "ocr_status": "COMPLETED",
            "confidence_score": 0.90,
            "note": "Phiếu test OCR Lexus 117 — dữ liệu demo đầy đủ (không che).",
        }
    raise ValueError("unknown lexus draft")


def _apply_payload_to_draft_row(draft: DbOcrDraft, payload: dict) -> None:
    wf_items = (payload.get("service_selection") or {}).get("window_film_items") or []
    job_items_str = ";".join(str(x) for x in wf_items)
    draft.image_filename = payload.get("source_file_name")
    draft.image_url = f"/static/test_orders/{payload.get('source_file_name')}"
    draft.ocr_status = payload.get("ocr_status") or "COMPLETED"
    draft.review_status = payload.get("review_status") or "NEEDS_REVIEW"
    
    # 4. Display customer as "Customer Name - KHL-xxx"
    # 5. Display dealer as "Dealer Name - DL-xxx"
    draft_id = draft.ocr_draft_id
    sfx = LEXUS_CUSTOMER_SUFFIX.get(draft_id, "115")
    dealer_name = payload.get("dealer_name") or "LEXUS TRUNG TÂM SÀI GÒN – Công Ty TNHH Ôtô Toyotsu Samco"
    draft.extracted_dealer_name = f"{dealer_name} - DL-001"
    
    cust = payload.get("customer_name") or payload.get("customer_masked") or ""
    draft.extracted_customer_name = f"{cust} - KHL-{sfx}"
    
    draft.extracted_vehicle_model = payload.get("model_name") or payload.get("vehicle_model_code")
    draft.sales_consultant = (payload.get("sales_consultant") or "").strip() or None
    draft.extracted_vin = payload.get("vin_number") or payload.get("vin_masked")
    draft.extracted_plate = ""
    draft.extracted_film_type = "Phim cách nhiệt Konica xe Lexus RX"
    draft.extracted_job_items = job_items_str
    draft.extracted_delivery_time = payload.get("requested_delivery_at")
    draft.extracted_notes = payload.get("note")
    draft.extracted_ppf_type = None
    draft.extracted_services = "WINDOW_FILM"
    draft.confidence_dealer = float(payload.get("confidence_score") or 0.9)
    draft.confidence_customer = float(payload.get("confidence_score") or 0.9)
    draft.confidence_vehicle = float(payload.get("confidence_score") or 0.9)
    draft.confidence_overall = float(payload.get("confidence_score") or 0.9)
    draft.extra_payload_json = json.dumps(payload, ensure_ascii=False)


def upsert_lexus_ocr_drafts(db: Session) -> Dict[str, Any]:
    """Tạo hoặc cập nhật 2 OCR draft test. Trả về updated_existing > 0 nếu đã tồn tại trước đó."""
    created = 0
    existed_before = 0
    for did in sorted(LEXUS_OCR_DRAFT_IDS):
        payload = _lexus_payload(did)
        row = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == did).first()
        if row:
            existed_before += 1
        else:
            row = DbOcrDraft(
                ocr_draft_id=did,
                image_file_id=f"IMG-LEXUS-TEST-{LEXUS_CUSTOMER_SUFFIX[did]}",
                created_at=_now(),
            )
            db.add(row)
            created += 1
        _apply_payload_to_draft_row(row, payload)
    db.commit()
    return {
        "status": "success",
        "created_new": created,
        "updated_existing": existed_before,
        "already_existed": existed_before > 0,
    }


def _ensure_dealer_lexus_sg(db: Session, actor: str, request_id_for_audit: str) -> None:
    did = "DEALER_LEXUS_SG"
    name = "LEXUS TRUNG TÂM SÀI GÒN – Công Ty TNHH Ôtô Toyotsu Samco"
    if db.query(DbDealer).filter(DbDealer.dealer_id == did).first():
        return
    db.add(
        DbDealer(
            dealer_id=did,
            dealer_name="Lexus Trung Tâm Sài Gòn",
            legal_name=name,
            dealer_group="LEXUS",
            address="Số 264, Đường Trần Hưng Đạo, Phường Cầu Ông Lãnh, TP.HCM",
            contact_phone="02837271555",
            status="ACTIVE",
            created_at=_now(),
        )
    )
    _audit(
        db,
        request_id_for_audit,
        "DEALER_CREATED",
        "DEALER",
        did,
        None,
        name,
        "Lexus OCR test confirm",
        actor,
    )


def confirm_lexus_test_ocr(
    db: Session,
    draft_id: str,
    data: Optional[dict],
    actor: str = "ADMIN-001",
) -> Dict[str, Any]:
    """Xác nhận phiếu Lexus test → Request động theo format DYC-YYMMDD-{6 cuối số khung}."""
    if not is_lexus_test_draft_id(draft_id):
        raise ValueError("not a lexus test draft")
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft:
        raise HTTPException(404, "OCR Draft not found")
    if draft.review_status in ("CONFIRMED", "CANCELLED"):
        raise HTTPException(400, "Draft đã xử lý.")

    payload = _lexus_payload(draft_id)
    if draft.extra_payload_json:
        try:
            payload = {**payload, **json.loads(draft.extra_payload_json)}
        except json.JSONDecodeError:
            pass

    # Dynamic Request ID generation: DYC-YYMMDD-{6 cuối số khung}
    vin_m = (data.get("vin") or payload.get("vin_number") or payload.get("vin_masked") or "").strip()
    req_date_str = (data.get("request_date") or payload.get("request_date") or "").strip()
    if not req_date_str:
        req_date_str = datetime.date.today().strftime("%Y-%m-%d")
    try:
        dt = datetime.datetime.strptime(req_date_str[:10], "%Y-%m-%d")
        yymmdd = dt.strftime("%y%m%d")
    except Exception:
        yymmdd = datetime.date.today().strftime("%y%m%d")
    
    vin_last_6 = vin_m[-6:] if len(vin_m) >= 6 else "000000"
    fixed_req_id = f"DYC-{yymmdd}-{vin_last_6}"

    existing_req = db.query(DbRequest).filter(DbRequest.request_id == fixed_req_id).first()
    if existing_req:
        raise HTTPException(400, f"Request test {fixed_req_id} đã tồn tại — xóa request cũ để tạo lại.")

    dealer_id = (payload.get("dealer_id") or "DEALER_LEXUS_SG").strip()
    # Format dealer name display as "Dealer Name - DL-xxx"
    dealer_name_disp = "Lexus Trung Tâm Sài Gòn - DL-001"
    
    cust_masked = (
        (data.get("customer_name") or payload.get("customer_name") or payload.get("customer_masked") or "")
        .strip()
    )
    
    vehicle_model = (data.get("vehicle_model") or payload.get("vehicle_model_code") or "RX350").strip()
    vm_norm = normalize_vehicle_model_code(vehicle_model) or vehicle_model.upper()
    model_year = 2026
    try:
        if data.get("model_year") is not None:
            model_year = int(data.get("model_year"))
    except (TypeError, ValueError):
        pass

    film_type = (data.get("film_type") or "Phim cách nhiệt").strip()
    svc_sel = payload.get("service_selection") or {}
    wf_codes: List[str] = list(svc_sel.get("window_film_items") or [])

    # Dynamic services selection parsing
    confirmed_services_str = (data.get("services") or "").strip()
    if confirmed_services_str:
        has_ppf = "PPF" in confirmed_services_str.upper()
        has_wf = "PCN" in confirmed_services_str.upper() or "WINDOW" in confirmed_services_str.upper() or "FILM" in confirmed_services_str.upper()
    else:
        has_ppf = bool(svc_sel.get("include_ppf", False))
        has_wf = bool(svc_sel.get("include_window_film", True))

    _ensure_dealer_lexus_sg(db, actor, fixed_req_id)

    sfx = LEXUS_CUSTOMER_SUFFIX[draft_id]
    customer_id = f"CUS-TEST-LEXUS-{sfx}"
    vehicle_id = f"VEH-TEST-LEXUS-{sfx}"
    
    # Customer name display format: "Customer Name - KHL-xxx"
    cust_display = f"{cust_masked} - KHL-{sfx}"

    cust_row = db.query(DbCustomer).filter(DbCustomer.customer_id == customer_id).first()
    addr_src = (payload.get("customer_address") or payload.get("address_masked") or "").strip()
    ph_src = (payload.get("customer_phone") or "").strip()
    nm_src = (payload.get("customer_name") or payload.get("customer_masked") or "").strip()
    if cust_row:
        if addr_src:
            cust_row.address = addr_src
            cust_row.full_address = addr_src
            cust_row.address_masked = addr_src
        if ph_src:
            cust_row.phone = ph_src
            cust_row.phone_masked = ph_src
        if nm_src:
            cust_row.customer_name = nm_src
            cust_row.customer_masked = nm_src
    else:
        db.add(
            DbCustomer(
                customer_id=customer_id,
                customer_name=cust_masked or customer_id,
                customer_masked=cust_masked or customer_id,
                phone=ph_src or None,
                phone_masked=ph_src or None,
                address=addr_src or None,
                address_masked=addr_src or None,
                full_address=addr_src or None,
                source_dealer_id=dealer_id,
                customer_type="END_CUSTOMER",
                source_channel="OCR",
                crm_status="NEW_PENDING_VERIFICATION",
                created_from_request_id=fixed_req_id,
                created_at=_now(),
            )
        )
        _audit(
            db,
            fixed_req_id,
            "CUSTOMER_CREATED_FROM_OCR",
            "CUSTOMER",
            customer_id,
            None,
            cust_display,
            "Lexus test OCR confirm",
            actor,
        )

    veh_existed = (
        db.query(DbVehicleProfile)
        .filter((DbVehicleProfile.vehicle_id == vehicle_id) | (DbVehicleProfile.vin_number == vin_m))
        .first()
        is not None
    )
    if not veh_existed:
        db.add(
            DbVehicleProfile(
                vehicle_id=vehicle_id,
                vin_number=vin_m or f"JTJBARBZ9N{sfx}00000"[:17],
                vin_masked=vin_m or f"JTJBARBZ9N{sfx}00000"[:17],
                vehicle_model_code=vm_norm,
                model_name=payload.get("model_name") or vehicle_model,
                model_year=model_year,
                customer_id=customer_id,
                dealer_id=dealer_id,
                created_from_request_id=fixed_req_id,
                vehicle_status="ACTIVE",
                status="ACTIVE",
                created_at=_now(),
            )
        )
        _audit(
            db,
            fixed_req_id,
            "VEHICLE_CREATED_FROM_OCR",
            "VEHICLE",
            vehicle_id,
            None,
            vehicle_model,
            "Lexus test OCR confirm",
            actor,
        )

    norm_res = resolve_vehicle_norm_with_year_fallback(db, vm_norm, model_year, film_type)
    wf_plan = _material_plan_for_items(wf_codes)
    norm_application: Dict[str, Any] = {
        "found": norm_res.get("found"),
        "norm_id": (norm_res.get("norm") or {}).get("norm_id") if norm_res.get("norm") else None,
        "norm": norm_res.get("norm"),
        "applied_items": [],
        "source": "AUTO_FROM_VEHICLE_NORM" if norm_res.get("found") else None,
        "film_type": film_type,
        "vehicle_model_code": vm_norm,
        "vehicle_model_code_raw": norm_res.get("vehicle_model_code_raw"),
        "vehicle_model_code_requested": norm_res.get("vehicle_model_code_requested"),
        "model_year": model_year,
        "model_year_requested": norm_res.get("model_year_requested"),
        "model_year_resolved": norm_res.get("model_year_resolved"),
        "resolution_strategy": norm_res.get("resolution_strategy"),
        "warning": norm_res.get("warning"),
        "warnings": list(norm_res.get("warnings") or []),
        "year_exact_match": norm_res.get("year_exact_match"),
    }

    needs_review = False
    review_notes: List[str] = []

    if norm_res.get("found"):
        wf_plan = apply_auto_fill_to_plan(wf_plan, norm_res.get("auto_fill_items") or [])
        norm_application["applied_items"] = list(norm_res.get("auto_fill_items") or [])
        _audit(db, fixed_req_id, "NORM_AUTO_FILLED", "NORM", norm_application.get("norm_id") or "—", None,
               json.dumps({"items": len(norm_application["applied_items"])}, ensure_ascii=False),
               "Resolve định mức Lexus test (có fallback năm nếu cần)", actor)
    else:
        needs_review = True
        review_notes.append("NO_VEHICLE_NORM_ACTIVE")
        norm_application["warning"] = norm_res.get("warning") or (
            f"Chưa có định mức active cho {vm_norm} năm {model_year}."
        )

    _hydrate_wf_plan_material_preferences(db, wf_plan, film_type)
    pref_ok = True
    for row in wf_plan:
        if (row.get("material_source") == "MISSING_PREFERENCE") or not (row.get("material_code") or "").strip():
            pref_ok = False
            needs_review = True
            review_notes.append(f"MISSING_MATERIAL_PREF:{row.get('job_item')}")
    if pref_ok and norm_res.get("found"):
        _audit(
            db,
            fixed_req_id,
            "MATERIAL_PREFERENCE_APPLIED",
            "REQUEST",
            fixed_req_id,
            None,
            json.dumps([x.get("job_item") for x in wf_plan], ensure_ascii=False),
            "Áp vật tư từ Material Preference (Lexus test)",
            actor,
        )

    primary_wf_mc = ""
    wf_block = "152x143"
    wf_len = 1.43
    cg = None
    wf_source_type: Optional[str] = None
    wf_source_id: Optional[str] = None
    if wf_plan and has_wf:
        wind = next((r for r in wf_plan if r.get("job_item") == "WINDSHIELD"), None)
        primary_wf_mc = ((wind or wf_plan[0]).get("material_code") or "").strip()
        cg = _wf_cut_group(db, vm_norm, primary_wf_mc or None)
        if cg:
            wf_block = f"{cg.cut_block_width_cm}x{cg.cut_block_length_cm}"
            wf_len = float(cg.deduction_length_m or wf_len)
        wf_source_type, wf_source_id = "LOT", None
        if primary_wf_mc:
            oc = _pick_offcut_for_material(db, primary_wf_mc, wf_len)
            if oc:
                wf_source_type, wf_source_id = "OFFCUT", oc.offcut_id
            else:
                wf_lot_obj = _pick_lot_for_material(db, primary_wf_mc, wf_len)
                if wf_lot_obj:
                    wf_source_type, wf_source_id = "LOT", wf_lot_obj.lot_id
                else:
                    needs_review = True
                    review_notes.append(f"OUT_OF_STOCK_{primary_wf_mc}")
        else:
            needs_review = True
            review_notes.append("MISSING_PRIMARY_WF_MATERIAL")

    status = "NEEDS_REVIEW" if needs_review else "ALLOCATED"
    if norm_res.get("warnings"):
        for w in norm_res["warnings"]:
            if w not in review_notes:
                review_notes.append(w)

    service_selection_out = {
        **svc_sel,
        "include_ppf": has_ppf,
        "include_window_film": has_wf,
        "display_model_name": payload.get("model_name"),
        "dealer_display_name": dealer_name_disp,
    }

    job_items_str = ";".join(wf_codes) if wf_codes else ""
    if has_ppf:
        job_items_str = (job_items_str + ";PPF_FULL") if job_items_str else "PPF_FULL"

    req = DbRequest(
        request_id=fixed_req_id,
        request_no=payload.get("request_no"),
        contract_no=payload.get("contract_no"),
        request_date=payload.get("request_date"),
        ocr_source_image=payload.get("source_file_name"),
        dealer_id=dealer_id,
        dealer_name=dealer_name_disp,
        customer_id=customer_id,
        customer_name=cust_display,
        vehicle_id=vehicle_id,
        vin_number=vin_m or None,
        vin_masked=vin_m or None,
        vehicle_model_code=vm_norm,
        material_code=primary_wf_mc or None,
        job_items=job_items_str,
        status=status,
        is_grouped_cut=bool(cg),
        cut_group_id=cg.cut_group_id if cg else None,
        planned_cut_block=wf_block if has_wf else None,
        planned_deduction_length_m=wf_len if has_wf else None,
        allocated_source_type=wf_source_type if has_wf else None,
        allocated_source_id=wf_source_id if has_wf else None,
        is_multi_workstream=(has_ppf and has_wf),
        requested_delivery_time=payload.get("requested_delivery_at"),
        created_at=_now(),
        source_channel="OCR",
        approved_by=None,
        model_name=(payload.get("model_name") or "").strip() or None,
        sales_consultant=(payload.get("sales_consultant") or "").strip() or None,
        service_selection_json=json.dumps(service_selection_out, ensure_ascii=False),
        norm_application_json=json.dumps(norm_application, ensure_ascii=False),
        exception_reason="; ".join(review_notes) if review_notes else None,
    )
    db.add(req)

    rid_slug = fixed_req_id.replace("-", "")

    # PPF Workstream Creation
    if has_ppf:
        ws_ppf = DbWorkstream(
            workstream_id=f"WS-PPF-{rid_slug}",
            request_id=fixed_req_id,
            workstream_type="PPF_INSTALLATION",
            team_type="PPF_TEAM",
            technician_team="PPF_TEAM_A",
            assigned_technician_id="KTV-PPF-001",
            assigned_technician_name="Trần Văn Bình",
            selected_material_code="T-TYPE",
            material_plan=None,
            planned_cut_block="152x1300",
            planned_deduction_length_m=13.0,
            status="PENDING_APPROVAL",
            actual_confirmation_status="PENDING",
            created_at=_now(),
        )
        db.add(ws_ppf)
        from ppf_allocation_service import build_default_ppf_allocation
        ws_ppf.ppf_allocation_json = json.dumps(build_default_ppf_allocation(ws_ppf), ensure_ascii=False)
        _audit(
            db,
            fixed_req_id,
            "WORKSTREAM_CREATED",
            "WORKSTREAM",
            ws_ppf.workstream_id,
            None,
            ws_ppf.workstream_type,
            "PPF luồng thi công (Lexus test)",
            actor,
            ws_ppf.workstream_id,
            ws_ppf.workstream_type,
        )

    # Window Film Workstream Creation
    if has_wf:
        ws_w = DbWorkstream(
            workstream_id=f"WS-WF-{rid_slug}",
            request_id=fixed_req_id,
            workstream_type="WINDOW_FILM_INSTALLATION",
            team_type="WINDOW_FILM_TEAM",
            technician_team="WINDOW_FILM_TEAM_B",
            assigned_technician_id="KTV-003",
            assigned_technician_name="Nguyễn Văn An",
            selected_material_code=primary_wf_mc or None,
            material_plan=json.dumps(wf_plan, ensure_ascii=False),
            cut_group_id=cg.cut_group_id if cg else None,
            planned_cut_block=wf_block,
            planned_deduction_length_m=wf_len,
            allocated_source_type=req.allocated_source_type,
            allocated_source_id=req.allocated_source_id,
            status="PENDING_APPROVAL",
            actual_confirmation_status="PENDING",
            created_at=_now(),
        )
        db.add(ws_w)
        db.flush()
        from wf_allocation_service import build_default_wf_allocation
        ws_w.wf_allocation_json = json.dumps(build_default_wf_allocation(db, ws_w), ensure_ascii=False)
        _audit(
            db,
            fixed_req_id,
            "WORKSTREAM_CREATED",
            "WORKSTREAM",
            ws_w.workstream_id,
            None,
            ws_w.workstream_type,
            "WINDOW_FILM luồng thi công (Lexus test)",
            actor,
            ws_w.workstream_id,
            ws_w.workstream_type,
        )

    draft.review_status = "CONFIRMED"
    draft.confirmed_by = actor
    draft.confirmed_at = _now()
    draft.created_request_id = fixed_req_id

    _audit(
        db,
        fixed_req_id,
        "OCR_DRAFT_CONFIRMED",
        "OCR_DRAFT",
        draft_id,
        "NEEDS_REVIEW",
        "CONFIRMED",
        "Admin xác nhận phiếu Lexus test",
        actor,
    )
    _audit(
        db,
        fixed_req_id,
        "REQUEST_CREATED_FROM_IMAGE",
        "REQUEST",
        fixed_req_id,
        None,
        json.dumps({"source": "OCR", "draft_id": draft_id}, ensure_ascii=False),
        "Tạo request từ OCR Lexus test",
        actor,
    )

    _add_notif(
        db,
        "📋 Request Lexus test từ OCR",
        f"{fixed_req_id} — Chờ Quản lý duyệt.",
        "APPROVAL_NEEDED",
        fixed_req_id,
        "REQUEST",
        "MANAGER",
    )
    db.commit()
    return {
        "status": "success",
        "request_id": fixed_req_id,
        "detail": f"✅ Đã tạo {fixed_req_id} từ {draft_id}. Trạng thái: {status}.",
        "norm": norm_application,
        "warnings": review_notes,
    }
