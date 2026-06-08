import os, uuid, datetime, json, logging, traceback, re, hashlib
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import (
    SessionLocal,
    init_db,
    database_is_sqlite,
    DbDealer,
    DbCustomer,
    DbVehicleProfile,
    DbLotInventory, DbOffcutInventory,
    DbRequest, DbWorkstream, DbJobCard,
    DbAuditLog, DbCuttingGroupMatrix,
    DbOcrDraft, DbNotification
)
from inventory_api import register_inventory_routes, assert_source_valid_for_wf6_commit, create_offcut_from_workstream_return
from customer_api import (
    register_customer_routes,
    customer_plain_address,
    customer_plain_phone,
    customer_display_name,
)
from vehicle_norm_api import register_vehicle_norm_routes
from location_api import register_location_routes
from material_preference_api import register_material_preference_routes
from vehicle_norm_logic import normalize_vehicle_model_code, resolve_vehicle_norm_with_year_fallback
from hr_api import router as hr_router
from workstream_material_scope import approved_allocation_material_codes
from ocr_lexus_test_data import (
    confirm_lexus_test_ocr,
    is_lexus_test_draft_id,
    upsert_lexus_ocr_drafts,
)

_log = logging.getLogger("uvicorn.error")


def _should_startup_demo_seed() -> bool:
    """
    - Mặc định SQLite (local): seed bộ demo chuẩn nếu DB trống (chưa có dealer).
    - PostgreSQL (DATABASE_URL): không seed — dữ liệu do bạn nhập / migrate (vận hành thật).
    - Ghi đè: DYC_STARTUP_SEED_DEMO=true|false|force|never (true/force = luôn thử seed nếu DB trống).
    """
    ex = (os.getenv("DYC_STARTUP_SEED_DEMO") or "").strip().lower()
    if ex in ("0", "false", "no", "never", "off"):
        return False
    if ex in ("1", "true", "yes", "force", "on"):
        return True
    return database_is_sqlite()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Schema + migration (SQLite) trước khi nhận request; seed demo tùy môi trường."""
    try:
        init_db()
        _log.info("DYC init_db() completed (schema / migrations).")
        from standard_seed_data import seed_all_demo_data_if_missing_canonical, try_location_master_import_warn_only

        db = SessionLocal()
        try:
            if _should_startup_demo_seed():
                if seed_all_demo_data_if_missing_canonical(db):
                    db.commit()
                    _log.info("DYC standard_seed: đã seed dữ liệu demo chuẩn (DB trống).")
                else:
                    db.rollback()
            else:
                db.rollback()
                _log.info("DYC startup: không chạy seed demo (PostgreSQL hoặc DYC_STARTUP_SEED_DEMO tắt).")
            # Định mức phim cách nhiệt: không import Excel tự động khi khởi động — dùng UI hoặc POST /api/vehicle-norms/import-from-excel
        except Exception:
            _log.exception("DYC seed skipped or partial.")
        finally:
            db.close()
        try_location_master_import_warn_only()
    except Exception:
        _log.exception("DYC init_db() failed — một số API có thể lỗi cho đến khi sửa DB.")
    yield


app = FastAPI(
    title="DYC Film Warehouse — Multi-Workstream Agentic Portal",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/admin/reset-database-standard-seed")
def admin_reset_database_standard_seed(request: Request):
    """
    Reset DB + seed chuẩn (demo). Bắt buộc ALLOW_DB_RESET=true và header X-Admin-Reset-Token.
    Không bật trên production thật.
    """
    import secrets
    from pathlib import Path

    if not database_is_sqlite():
        raise HTTPException(
            status_code=400,
            detail={
                "error": "RESET_SQLITE_ONLY",
                "message": "Reset + seed chuẩn chỉ hỗ trợ SQLite. Với PostgreSQL (DATABASE_URL) hãy dùng backup/restore hoặc công cụ quản trị DB.",
            },
        )
    if os.getenv("ALLOW_DB_RESET", "").lower() != "true":
        raise HTTPException(status_code=403, detail="ALLOW_DB_RESET is not enabled")
    expected = (os.getenv("ADMIN_RESET_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(status_code=403, detail="ADMIN_RESET_TOKEN is not set")
    got = (request.headers.get("X-Admin-Reset-Token") or "").strip()
    if not secrets.compare_digest(got, expected):
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Reset-Token")
    from reset_database_full_seed import run_full_reset_sequence

    here = Path(__file__).resolve().parent
    out = run_full_reset_sequence(here)
    return {
        "status": "success",
        "message": "Database reset + standard seed completed (demo only).",
        "backup_path": out.get("backup_path"),
        "counts": out.get("counts"),
    }

register_inventory_routes(app, get_db)
register_customer_routes(app, get_db)
register_vehicle_norm_routes(app, get_db)
register_material_preference_routes(app, get_db)
register_location_routes(app)
app.include_router(hr_router)

def _now():
    return datetime.datetime.utcnow().isoformat() + "Z"

def _uid(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:8].upper()}"

def _add_audit_log(db, action, draft_id, req_id, workstream_id, extra_id=""):
    from database import DbAuditLog
    log = DbAuditLog(
        log_id=_uid("LOG-"),
        transaction_type=action,
        request_id=req_id,
        workstream_id=workstream_id,
        source_id=draft_id,
        after_value=extra_id,
        actor="ADMIN",
        timestamp=_now()
    )
    db.add(log)

# ─── MATERIAL RULES ───────────────────────────────────────────────────────────
PPF_DEFAULTS = {
    "planned_cut_block": "152x1300",
    "planned_deduction_length_m": 13.0,
    "options": ["T-TYPE", "M-TYPE"],
    "default_material": "T-TYPE",
}

WINDOW_FILM_PLAN = []  # legacy — dùng build_default_window_film_plan_json(db) khi có session

# ─── HELPERS ──────────────────────────────────────────────────────────────────
def _add_notif(db: Session, title: str, body: str, notif_type: str,
               related_id: str, related_type: str, recipient_role: str,
               workstream_id: str = None, workstream_type: str = None, team_type: str = None):
    db.add(DbNotification(
        notif_id=f"NOTIF-{_uid()}",
        title=title, body=body, notif_type=notif_type,
        related_id=related_id, related_type=related_type,
        workstream_id=workstream_id, workstream_type=workstream_type,
        team_type=team_type, recipient_role=recipient_role,
        is_read=False, created_at=_now()
    ))

def _audit(db: Session, request_id, transaction_type, source_type, source_id,
           before_value, after_value, reason, actor,
           workstream_id=None, workstream_type=None, cut_group_id=None):
    sfx = (workstream_id or request_id or "SYS")[-4:].upper()
    ts = datetime.date.today().strftime("%Y%m%d")
    db.add(DbAuditLog(
        log_id=f"AUD-{ts}-{sfx}-{_uid('')[:8]}",
        transaction_id=f"TXN-{ts}-{sfx}-{_uid('')[:8]}",
        request_id=request_id, workstream_id=workstream_id,
        workstream_type=workstream_type, cut_group_id=cut_group_id,
        transaction_type=transaction_type, transaction_status="CONFIRMED",
        source_type=source_type, source_id=source_id,
        before_value=before_value, after_value=after_value,
        reason=reason, actor=actor, timestamp=_now()
    ))

def _create_workstreams_for_request(db: Session, req: DbRequest) -> list:
    """Auto-create PPF + Window Film workstreams for a request."""
    from material_preference_logic import build_default_window_film_plan_json, resolve_material_preference

    today = datetime.date.today().strftime("%Y%m%d")
    wss = []

    # 1. PPF Workstream
    ppf_ws = DbWorkstream(
        workstream_id=f"WS-PPF-{today}-{req.request_id[-3:]}",
        request_id=req.request_id,
        workstream_type="PPF_INSTALLATION",
        team_type="PPF_TEAM",
        technician_team="PPF_TEAM_A",
        assigned_technician_id="KTV-PPF-001",
        assigned_technician_name="Trần Văn Bình",
        selected_material_code="T-TYPE",
        material_plan=None,
        planned_cut_block=PPF_DEFAULTS["planned_cut_block"],
        planned_deduction_length_m=PPF_DEFAULTS["planned_deduction_length_m"],
        status="PENDING_APPROVAL",
        actual_confirmation_status="PENDING",
        created_at=_now(),
    )
    db.add(ppf_ws)
    from ppf_allocation_service import build_default_ppf_allocation

    ppf_ws.ppf_allocation_json = json.dumps(build_default_ppf_allocation(ppf_ws), ensure_ascii=False)
    wss.append(ppf_ws)

    wf_ft = "Phim cách nhiệt"
    wf_plan_json = build_default_window_film_plan_json(db, wf_ft)
    wf_sel_res = resolve_material_preference(db, wf_ft, "WINDSHIELD")
    try:
        _plan_list = json.loads(wf_plan_json) if wf_plan_json else []
    except json.JSONDecodeError:
        _plan_list = []
    _wind_plan = next((x for x in _plan_list if x.get("job_item") == "WINDSHIELD"), None)
    wf_sel_mc = (wf_sel_res.get("preferred_material_code") or "").strip() or (
        ((_wind_plan or {}).get("material_code") or "").strip()
    )

    # 2. Window Film Workstream
    wf_ws = DbWorkstream(
        workstream_id=f"WS-WF-{today}-{req.request_id[-3:]}",
        request_id=req.request_id,
        workstream_type="WINDOW_FILM_INSTALLATION",
        team_type="WINDOW_FILM_TEAM",
        technician_team="WINDOW_FILM_TEAM_B",
        assigned_technician_id="KTV-003",
        assigned_technician_name="Nguyễn Văn An",
        selected_material_code=wf_sel_mc or None,
        material_plan=wf_plan_json,
        cut_group_id="CG_RX350_SIDE_REAR",
        planned_cut_block="152x143",
        planned_deduction_length_m=1.43,
        status="PENDING_APPROVAL",
        actual_confirmation_status="PENDING",
        created_at=_now(),
    )
    db.add(wf_ws)
    wss.append(wf_ws)
    from wf_allocation_service import build_default_wf_allocation

    wf_ws.wf_allocation_json = json.dumps(build_default_wf_allocation(db, wf_ws), ensure_ascii=False)

    req.is_multi_workstream = True
    return wss

def _update_request_status_from_workstreams(db: Session, req: DbRequest):
    """Compute request aggregate status from workstream statuses."""
    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == req.request_id).all()
    if not wss:
        return
    statuses = [ws.status for ws in wss]
    if all(s in ("CLOSED", "CANCELLED") for s in statuses):
        req.status = "CLOSED"
    elif all(s in ("CLOSED", "COMPLETED", "CANCELLED") for s in statuses):
        req.status = "WAITING_INVENTORY_COMMIT"
    elif any(s == "CLOSED" for s in statuses):
        req.status = "PARTIALLY_COMPLETED"
    elif any(s == "IN_PROGRESS" for s in statuses):
        req.status = "IN_PROGRESS"
    elif any(s == "APPROVED" for s in statuses):
        req.status = "APPROVED"
    elif any(s == "PENDING_TECH_PREFLIGHT" for s in statuses):
        if getattr(req, "status", None) != "NEEDS_REVIEW":
            req.status = "ALLOCATED"
    elif all(s == "PENDING_APPROVAL" for s in statuses):
        if getattr(req, "status", None) != "NEEDS_REVIEW":
            req.status = "ALLOCATED"  # ready for approval


def _parent_links_for_ws_offcut(db: Session, source_type: str, source_id: str) -> tuple:
    """LOT cha / mảnh cha khi tạo mảnh dư từ hoàn tất luồng (đồng bộ với nhập mảnh dư thủ công)."""
    st = (source_type or "LOT").upper()
    sid = (source_id or "").strip()
    pl, po = None, None
    if st == "LOT" and sid:
        pl = sid
    elif st == "OFFCUT" and sid:
        po = sid
        par = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
        if par and (par.parent_lot_id or "").strip():
            pl = (par.parent_lot_id or "").strip()
    return pl, po


def _workstream_offcut_material_code(ws: DbWorkstream, default_mc: str = "JB20") -> str:
    """Mã vật tư dùng khi tạo mảnh dư lúc commit — ưu tiên mã KTV chọn lúc submit-actual."""
    o = (getattr(ws, "offcut_material_code", None) or "").strip()
    if o:
        return o
    return ((ws.selected_material_code or default_mc).strip() or default_mc)


def _commit_workstream_inventory(db: Session, ws: DbWorkstream, tech_id: str = "KTV-003"):
    """Commit inventory transaction for a single workstream."""
    # Window Film: trừ từng nguồn theo wf_allocation_json (WF6)
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and getattr(ws, "wf_allocation_json", None):
        try:
            wf_alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            wf_alloc = {}
        if wf_alloc.get("items"):
            from wf_allocation_service import commit_wf_multi_source_inventory

            if commit_wf_multi_source_inventory(db, ws, tech_id, lambda *args: _audit(db, *args)):
                from wf_allocation_service import commit_wf_extra_cut_inventory

                commit_wf_extra_cut_inventory(db, ws, tech_id, lambda *args: _audit(db, *args))
                source_type = ws.allocated_source_type or "LOT"
                source_id = ws.allocated_source_id or ""
                new_offcut_id = None
                if ws.has_new_offcut and ws.offcut_length_m and ws.offcut_width_m:
                    mc_off = _workstream_offcut_material_code(ws, "JB20")
                    base = f"SUBLOT-{mc_off}"
                    cnt = db.query(DbOffcutInventory).filter(
                        DbOffcutInventory.offcut_id.like(f"{base}-%")).count()
                    new_offcut_id = f"{base}-{str(cnt+1).zfill(3)}"
                    pl, po = _parent_links_for_ws_offcut(db, source_type, source_id)
                    create_offcut_from_workstream_return(
                        db,
                        offcut_id=new_offcut_id,
                        material_code=mc_off,
                        width_m=float(ws.offcut_width_m),
                        length_m=float(ws.offcut_length_m),
                        quality_status=ws.offcut_quality_status or "NORMAL",
                        storage_location=ws.offcut_storage_location or "OFFCUT-RACK-C",
                        request_id=ws.request_id,
                        workstream_id=ws.workstream_id,
                        job_card_id=ws.job_card_id,
                        performed_by=tech_id,
                        note=ws.technician_note,
                        parent_lot_id=pl,
                        parent_offcut_id=po,
                        film_type="WINDOW_FILM",
                    )
                    ws.created_offcut_id = new_offcut_id
                    _audit(db, ws.request_id, "CREATE_OFFCUT", source_type, source_id,
                           "None", f"{new_offcut_id}",
                           f"Mảnh dư mới từ {ws.workstream_type}",
                           tech_id, ws.workstream_id, ws.workstream_type)
                if ws.has_scrap and ws.scrap_area_m2:
                    _audit(db, ws.request_id, "RECORD_SCRAP", source_type, source_id,
                           "None", f"Scrap {ws.scrap_area_m2}m²",
                           f"Phế liệu phát sinh {ws.workstream_type}",
                           tech_id, ws.workstream_id, ws.workstream_type)
                ws.inventory_committed = True
                ws.status = "CLOSED"
                ws.closed_at = _now()
                return new_offcut_id

    # PPF: trừ từng nguồn theo ppf_allocation_json (WF6)
    if ws.workstream_type == "PPF_INSTALLATION" and getattr(ws, "ppf_allocation_json", None):
        try:
            alloc = json.loads(ws.ppf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
        if alloc.get("items"):
            from ppf_allocation_service import commit_ppf_multi_source_inventory

            if commit_ppf_multi_source_inventory(db, ws, tech_id, lambda *args: _audit(db, *args)):
                source_type = ws.allocated_source_type or "LOT"
                source_id = ws.allocated_source_id or f"LOT-{ws.selected_material_code or 'T-TYPE'}-001"
                new_offcut_id = None
                if ws.has_new_offcut and ws.offcut_length_m and ws.offcut_width_m:
                    mc_off = _workstream_offcut_material_code(ws, "T-TYPE")
                    base = f"SUBLOT-{mc_off}"
                    cnt = db.query(DbOffcutInventory).filter(
                        DbOffcutInventory.offcut_id.like(f"{base}-%")).count()
                    new_offcut_id = f"{base}-{str(cnt+1).zfill(3)}"
                    pl, po = _parent_links_for_ws_offcut(db, source_type, source_id)
                    create_offcut_from_workstream_return(
                        db,
                        offcut_id=new_offcut_id,
                        material_code=mc_off,
                        width_m=float(ws.offcut_width_m),
                        length_m=float(ws.offcut_length_m),
                        quality_status=ws.offcut_quality_status or "NORMAL",
                        storage_location=ws.offcut_storage_location or "OFFCUT-RACK-C",
                        request_id=ws.request_id,
                        workstream_id=ws.workstream_id,
                        job_card_id=ws.job_card_id,
                        performed_by=tech_id,
                        note=ws.technician_note,
                        parent_lot_id=pl,
                        parent_offcut_id=po,
                        film_type="PPF",
                    )
                    ws.created_offcut_id = new_offcut_id
                    _audit(db, ws.request_id, "CREATE_OFFCUT", source_type, source_id,
                           "None", f"{new_offcut_id}",
                           f"Mảnh dư mới từ {ws.workstream_type}",
                           tech_id, ws.workstream_id, ws.workstream_type)
                if ws.has_scrap and ws.scrap_area_m2:
                    _audit(db, ws.request_id, "RECORD_SCRAP", source_type, source_id,
                           "None", f"Scrap {ws.scrap_area_m2}m²",
                           f"Phế liệu phát sinh {ws.workstream_type}",
                           tech_id, ws.workstream_id, ws.workstream_type)
                ws.inventory_committed = True
                ws.status = "CLOSED"
                ws.closed_at = _now()
                return new_offcut_id

    source_type = ws.allocated_source_type or "LOT"
    source_id = ws.allocated_source_id or f"LOT-{ws.selected_material_code}-001"
    before_bal, after_bal = 0.0, 0.0
    actual_len = ws.actual_length_m or ws.planned_deduction_length_m or 0.0

    if source_type == "LOT":
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == source_id).first()
        if lot:
            before_bal = lot.remaining_length_m
            lot.remaining_length_m = round(max(0.0, lot.remaining_length_m - actual_len), 3)
            after_bal = lot.remaining_length_m
            lot.is_locked = False
            lot.is_opened = True
    elif source_type == "OFFCUT":
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == source_id).first()
        if oc:
            before_bal = oc.length_m
            oc.length_m = 0.0; oc.area_m2 = 0.0; oc.status = "USED"; oc.is_locked = False
            after_bal = 0.0

    _audit(db, ws.request_id, f"ISSUE_FROM_{source_type}", source_type, source_id,
           f"{before_bal}m", f"{after_bal}m",
           f"Commit kho {ws.workstream_type} — KTV {tech_id}",
           tech_id, ws.workstream_id, ws.workstream_type)

    # Create offcut if any
    new_offcut_id = None
    if ws.has_new_offcut and ws.offcut_length_m and ws.offcut_width_m:
        dmc = "T-TYPE" if ws.workstream_type == "PPF_INSTALLATION" else "JB20"
        mc_off = _workstream_offcut_material_code(ws, dmc)
        base = f"SUBLOT-{mc_off}"
        cnt = db.query(DbOffcutInventory).filter(
            DbOffcutInventory.offcut_id.like(f"{base}-%")).count()
        new_offcut_id = f"{base}-{str(cnt+1).zfill(3)}"
        pl, po = _parent_links_for_ws_offcut(db, source_type, source_id)
        ft = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "WINDOW_FILM"
        create_offcut_from_workstream_return(
            db,
            offcut_id=new_offcut_id,
            material_code=mc_off,
            width_m=float(ws.offcut_width_m),
            length_m=float(ws.offcut_length_m),
            quality_status=ws.offcut_quality_status or "NORMAL",
            storage_location=ws.offcut_storage_location or "OFFCUT-RACK-C",
            request_id=ws.request_id,
            workstream_id=ws.workstream_id,
            job_card_id=ws.job_card_id,
            performed_by=tech_id,
            note=ws.technician_note,
            parent_lot_id=pl,
            parent_offcut_id=po,
            film_type=ft,
        )
        ws.created_offcut_id = new_offcut_id
        _audit(db, ws.request_id, "CREATE_OFFCUT", source_type, source_id,
               "None", f"{new_offcut_id}",
               f"Mảnh dư mới từ {ws.workstream_type}",
               tech_id, ws.workstream_id, ws.workstream_type)

    if ws.has_scrap and ws.scrap_area_m2:
        _audit(db, ws.request_id, "RECORD_SCRAP", source_type, source_id,
               "None", f"Scrap {ws.scrap_area_m2}m²",
               f"Phế liệu phát sinh {ws.workstream_type}",
               tech_id, ws.workstream_id, ws.workstream_type)

    _audit(db, ws.request_id, "RELEASE_LOCK", source_type, source_id,
           "is_locked=true", "is_locked=false",
           f"Giải phóng Soft Lock sau commit {ws.workstream_type}",
           "SYSTEM", ws.workstream_id, ws.workstream_type)

    ws.inventory_committed = True
    ws.status = "CLOSED"
    ws.closed_at = _now()
    return new_offcut_id

# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
def _dashboard_fallback_payload(detail: str):
    """Luôn trả JSON (không plain text) cho frontend — HTTP 200 để fetch không fail parse."""
    fb = {
        "total_lots": 0,
        "active_offcuts": 0,
        "total_scrap_m2": 0.0,
        "total_requests": 0,
        "closed_requests": 0,
        "partial_requests": 0,
        "reusability_rate": 0.0,
        "hitl_approval_needed": 0,
        "tech_confirmation_needed": 0,
        "completed_requests": 0,
        "ppf_in_progress": 0,
        "wf_in_progress": 0,
        "ppf_completed": 0,
        "wf_completed": 0,
        "pending_approval_workstreams": 0,
        "jobs_in_progress": 0,
        "unread_notifications": 0,
        "ocr_pending_review": 0,
        "total_customers": 0,
        "total_dealers": 0,
        "total_vehicles": 0,
        "manual_requests_today": 0,
        "ocr_requests_today": 0,
    }
    return {
        "ok": False,
        "error": "DASHBOARD_LOAD_FAILED",
        "message": "Không tải được dữ liệu tổng quan",
        "detail": (detail or "")[:500],
        "fallback": fb,
    }


@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    try:
        total_lots = db.query(DbLotInventory).count()
        active_offcuts = db.query(DbOffcutInventory).filter(
            DbOffcutInventory.status == "ACTIVE").count()
        scrap_m2 = sum(r.scrap_area_m2 or 0 for r in db.query(DbRequest).all()) + 0.15
        total_reqs = db.query(DbRequest).count()
        closed_reqs = db.query(DbRequest).filter(DbRequest.status == "CLOSED").count()
        partial_reqs = db.query(DbRequest).filter(
            DbRequest.status == "PARTIALLY_COMPLETED").count()
        used_offcuts = db.query(DbOffcutInventory).filter(
            DbOffcutInventory.status == "USED").count()
        total_offcuts = db.query(DbOffcutInventory).count()
        reusability = round(used_offcuts / total_offcuts * 100, 1) if total_offcuts else 64.2

        all_ws = db.query(DbWorkstream).all()
        ppf_ws = [w for w in all_ws if w.workstream_type == "PPF_INSTALLATION"]
        wf_ws = [w for w in all_ws if w.workstream_type == "WINDOW_FILM_INSTALLATION"]
        ppf_in_progress = sum(1 for w in ppf_ws if w.status == "IN_PROGRESS")
        wf_in_progress = sum(1 for w in wf_ws if w.status == "IN_PROGRESS")
        ppf_completed = sum(1 for w in ppf_ws if w.status in ("CLOSED", "COMPLETED"))
        wf_completed = sum(1 for w in wf_ws if w.status in ("CLOSED", "COMPLETED"))

        pending_approval_ws = db.query(DbWorkstream).filter(
            DbWorkstream.status == "PENDING_APPROVAL").count()
        approval_needed = db.query(DbRequest).filter(
            DbRequest.status == "ALLOCATED").count()
        tech_needed = db.query(DbRequest).filter(
            DbRequest.status.in_(["APPROVED", "IN_PROGRESS"])).count()

        unread_notifs = db.query(DbNotification).filter(
            DbNotification.is_read == False).count()
        ocr_pending = db.query(DbOcrDraft).filter(
            DbOcrDraft.review_status.in_(["REVIEWING", "NEEDS_REVIEW"])
        ).count()
        total_customers = db.query(DbCustomer).count()
        total_dealers = db.query(DbDealer).count()
        total_vehicles = db.query(DbVehicleProfile).count()
        today_prefix = datetime.date.today().strftime("%Y-%m-%d")
        manual_today = db.query(DbRequest).filter(
            DbRequest.source_channel == "MANUAL",
            DbRequest.created_at.like(f"{today_prefix}%"),
        ).count()
        ocr_today = db.query(DbRequest).filter(
            DbRequest.created_at.like(f"{today_prefix}%"),
            or_(DbRequest.source_channel == "OCR", DbRequest.source_channel == None),
        ).count()
        jobs_in_progress = db.query(DbJobCard).filter(
            DbJobCard.status == "IN_PROGRESS").count()

        body = {
            "ok": True,
            "total_lots": total_lots,
            "active_offcuts": active_offcuts,
            "total_scrap_m2": round(scrap_m2, 3),
            "total_requests": total_reqs,
            "closed_requests": closed_reqs,
            "partial_requests": partial_reqs,
            "reusability_rate": reusability,
            "hitl_approval_needed": approval_needed,
            "tech_confirmation_needed": tech_needed,
            "completed_requests": closed_reqs,
            "ppf_in_progress": ppf_in_progress,
            "wf_in_progress": wf_in_progress,
            "ppf_completed": ppf_completed,
            "wf_completed": wf_completed,
            "pending_approval_workstreams": pending_approval_ws,
            "jobs_in_progress": jobs_in_progress,
            "unread_notifications": unread_notifs,
            "ocr_pending_review": ocr_pending,
            "total_customers": total_customers,
            "total_dealers": total_dealers,
            "total_vehicles": total_vehicles,
            "manual_requests_today": manual_today,
            "ocr_requests_today": ocr_today,
        }
        return JSONResponse(content=body, media_type="application/json")
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        tb = traceback.format_exc()
        _log.error("GET /api/dashboard failed:\n%s", tb)
        safe = str(e)[:300] if str(e) else type(e).__name__
        return JSONResponse(
            status_code=200,
            content=_dashboard_fallback_payload(safe),
            media_type="application/json",
        )

# ═══════════════════════════════════════════════════════════════════════════════
# MONTHLY DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/monthly-dashboard")
def get_monthly_dashboard(db: Session = Depends(get_db)):
    from collections import defaultdict
    monthly = defaultdict(lambda: {
        "total_requests": 0, "closed": 0, "on_time": 0, "late": 0,
        "ppf_jobs": 0, "wf_jobs": 0,
        "ppf_completed": 0, "wf_completed": 0,
        "t_type_count": 0, "m_type_count": 0,
        "rt40_jobs": 0, "jb20_jobs": 0,
        "scrap_m2": 0.0, "material_usage": defaultdict(float),
    })
    mock_history = {
        "2026-01": {"total_requests":8,"closed":7,"on_time":6,"late":1,"ppf_jobs":7,"wf_jobs":7,"ppf_completed":7,"wf_completed":6,"t_type_count":5,"m_type_count":2,"rt40_jobs":7,"jb20_jobs":7,"scrap_m2":1.2,"material_usage":{"JB20":12.5,"T-TYPE":91.0,"M-TYPE":26.0,"RT40":1.4}},
        "2026-02": {"total_requests":11,"closed":10,"on_time":9,"late":1,"ppf_jobs":11,"wf_jobs":11,"ppf_completed":10,"wf_completed":10,"t_type_count":8,"m_type_count":2,"rt40_jobs":11,"jb20_jobs":11,"scrap_m2":1.8,"material_usage":{"JB20":17.2,"T-TYPE":104.0,"M-TYPE":26.0,"RT40":2.2}},
        "2026-03": {"total_requests":14,"closed":13,"on_time":11,"late":2,"ppf_jobs":14,"wf_jobs":14,"ppf_completed":13,"wf_completed":13,"t_type_count":10,"m_type_count":3,"rt40_jobs":14,"jb20_jobs":14,"scrap_m2":2.1,"material_usage":{"JB20":22.0,"T-TYPE":130.0,"M-TYPE":39.0,"RT40":2.8}},
        "2026-04": {"total_requests":9,"closed":9,"on_time":8,"late":1,"ppf_jobs":9,"wf_jobs":9,"ppf_completed":9,"wf_completed":9,"t_type_count":7,"m_type_count":2,"rt40_jobs":9,"jb20_jobs":9,"scrap_m2":1.4,"material_usage":{"JB20":14.4,"T-TYPE":91.0,"M-TYPE":26.0,"RT40":1.8}},
        "2026-05": {"total_requests":16,"closed":15,"on_time":14,"late":1,"ppf_jobs":16,"wf_jobs":16,"ppf_completed":15,"wf_completed":15,"t_type_count":11,"m_type_count":4,"rt40_jobs":16,"jb20_jobs":16,"scrap_m2":2.6,"material_usage":{"JB20":25.6,"T-TYPE":143.0,"M-TYPE":52.0,"RT40":3.2}},
    }
    for k, v in mock_history.items():
        monthly[k] = v
    # Add real 2026-06 data
    all_reqs = db.query(DbRequest).all()
    all_ws = db.query(DbWorkstream).all()
    for r in all_reqs:
        key = "2026-06"
        monthly[key]["total_requests"] += 1
        if r.status == "CLOSED": monthly[key]["closed"] += 1
    for ws in all_ws:
        key = "2026-06"
        if ws.workstream_type == "PPF_INSTALLATION":
            monthly[key]["ppf_jobs"] += 1
            if ws.status == "CLOSED": monthly[key]["ppf_completed"] += 1
            if ws.selected_material_code == "T-TYPE": monthly[key]["t_type_count"] += 1
            elif ws.selected_material_code == "M-TYPE": monthly[key]["m_type_count"] += 1
            monthly[key]["material_usage"][ws.selected_material_code or "T-TYPE"] += \
                (ws.actual_length_m or ws.planned_deduction_length_m or 0)
        elif ws.workstream_type == "WINDOW_FILM_INSTALLATION":
            monthly[key]["wf_jobs"] += 1
            if ws.status == "CLOSED": monthly[key]["wf_completed"] += 1
            monthly[key]["rt40_jobs"] += 1
            monthly[key]["jb20_jobs"] += 1
            monthly[key]["material_usage"]["JB20"] += \
                (ws.actual_length_m or ws.planned_deduction_length_m or 0)

    sorted_months = sorted(monthly.keys())[-6:]
    result = []
    for m in sorted_months:
        d = monthly[m]
        tr = max(d["total_requests"], 1)
        pj = max(d["ppf_jobs"], 1); wj = max(d["wf_jobs"], 1)
        result.append({
            "month": m, "total_requests": d["total_requests"],
            "closed": d["closed"],
            "on_time": d.get("on_time",0), "late": d.get("late",0),
            "ppf_jobs": d["ppf_jobs"], "wf_jobs": d["wf_jobs"],
            "ppf_completed": d["ppf_completed"], "wf_completed": d["wf_completed"],
            "t_type_count": d.get("t_type_count",0), "m_type_count": d.get("m_type_count",0),
            "rt40_jobs": d.get("rt40_jobs",0), "jb20_jobs": d.get("jb20_jobs",0),
            "scrap_m2": round(d["scrap_m2"],2),
            "completion_rate": round(d["closed"]/tr*100,1),
            "on_time_rate": round(d.get("on_time",0)/max(d.get("on_time",0)+d.get("late",1),1)*100,1),
            "ppf_completion_rate": round(d["ppf_completed"]/pj*100,1),
            "wf_completion_rate": round(d["wf_completed"]/wj*100,1),
            "material_usage": dict(d.get("material_usage", {})),
        })
    return result

# ═══════════════════════════════════════════════════════════════════════════════
# REQUESTS
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/requests")
def get_requests(db: Session = Depends(get_db)):
    return db.query(DbRequest).order_by(DbRequest.created_at.desc()).all()

@app.get("/api/requests/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db)):
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req:
        raise HTTPException(404, "Not found")
    d = req.__dict__.copy()
    d.pop("_sa_instance_state", None)
    try:
        cust = db.query(DbCustomer).filter(DbCustomer.customer_id == req.customer_id).first()
        if cust:
            d["customer_phone"] = customer_plain_phone(cust) or None
            d["customer_address"] = customer_plain_address(cust) or None
            d["customer_name"] = customer_display_name(cust, (d.get("customer_name") or "").strip())
        veh = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == req.vehicle_id).first()
        if veh:
            if not (d.get("vin_number") or "").strip():
                d["vin_number"] = (veh.vin_number or "").strip() or None
            if not (d.get("vin_masked") or "").strip():
                d["vin_masked"] = (veh.vin_masked or veh.vin_number or "").strip() or None
            if veh.model_year is not None:
                d["model_year"] = int(veh.model_year)
            if not (d.get("model_name") or "").strip():
                d["model_name"] = (veh.model_name or "").strip() or None
        if not (d.get("sales_consultant") or "").strip():
            d["sales_consultant"] = getattr(req, "sales_consultant", None) or None
        deal = db.query(DbDealer).filter(DbDealer.dealer_id == req.dealer_id).first()
        if deal and not (d.get("dealer_name") or "").strip():
            d["dealer_name"] = (deal.dealer_name or "").strip() or None
    except Exception:
        pass
    if req.service_selection_json:
        try:
            d["service_selection"] = json.loads(req.service_selection_json)
        except Exception:
            d["service_selection"] = None
    if getattr(req, "norm_application_json", None):
        try:
            d["norm_application"] = json.loads(req.norm_application_json)
        except Exception:
            d["norm_application"] = None
    else:
        d["norm_application"] = None
    return d


@app.put("/api/requests/{request_id}/norm-override")
def override_request_norm(request_id: str, data: dict, db: Session = Depends(get_db)):
    reason = (data.get("reason") or "").strip()
    if not reason:
        raise HTTPException(400, "reason bắt buộc")
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req:
        raise HTTPException(404, "Không tìm thấy request")
    allowed = {"DRAFT", "STANDARDIZED", "NORM_ASSIGNED", "ALLOCATED", "NEEDS_REVIEW", "EXCEPTION_HOLD"}
    if req.status not in allowed and not data.get("admin_override"):
        raise HTTPException(400, "Chỉ ghi đè định mức khi đơn chưa phê duyệt (hoặc admin_override).")
    actor = data.get("updated_by") or "WEB"
    prev = {}
    try:
        prev = json.loads(req.norm_application_json) if req.norm_application_json else {}
    except Exception:
        prev = {}
    applied = data.get("applied_items") or data.get("auto_fill_items") or []
    norm_block = {
        "norm_id": data.get("norm_id") or (prev.get("norm") or {}).get("norm_id"),
        "film_type": data.get("film_type") or (prev.get("norm") or {}).get("film_type"),
        "vehicle_model_code": data.get("vehicle_model_code") or req.vehicle_model_code,
        "model_year_range": data.get("model_year_range") or (prev.get("norm") or {}).get("model_year_range"),
        "applied_items": applied,
        "source": "MANUAL_OVERRIDE",
        "override_reason": reason,
    }
    req.norm_application_json = json.dumps(norm_block, ensure_ascii=False)
    # Cập nhật material_plan luồng WF nếu còn PENDING_APPROVAL
    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
    for ws in wss:
        if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and ws.status == "PENDING_APPROVAL" and ws.material_plan:
            try:
                plan = json.loads(ws.material_plan)
            except Exception:
                plan = []
            idx = {x.get("job_item"): i for i, x in enumerate(plan)}
            for it in applied:
                ji = it.get("job_item")
                if ji in idx:
                    row = plan[idx[ji]]
                    row["material_code"] = it.get("material_code", row.get("material_code"))
                    row["size"] = it.get("size", row.get("size"))
                    row["width_cm"] = it.get("width_cm", row.get("width_cm"))
                    row["length_cm"] = it.get("length_cm", row.get("length_cm"))
            ws.material_plan = json.dumps(plan, ensure_ascii=False)
    _audit(
        db,
        request_id,
        "REQUEST_NORM_OVERRIDDEN",
        "REQUEST",
        request_id,
        json.dumps(prev, ensure_ascii=False),
        req.norm_application_json,
        reason,
        actor,
    )
    db.commit()
    db.refresh(req)
    return get_request(request_id, db)

@app.get("/api/requests/{request_id}/workstreams")
def get_workstreams(request_id: str, db: Session = Depends(get_db)):
    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
    return [_serialize_workstream(ws, db) for ws in wss]

@app.get("/api/lots")
def get_lots(db: Session = Depends(get_db)):
    return db.query(DbLotInventory).all()

@app.get("/api/offcuts")
def get_offcuts(db: Session = Depends(get_db)):
    return db.query(DbOffcutInventory).all()

@app.get("/api/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    action: Optional[str] = Query(None, description="Lọc theo transaction_type"),
    entity_type: Optional[str] = Query(None, description="Lọc theo source_type"),
    entity_id: Optional[str] = Query(None, description="Lọc theo source_id"),
    request_id: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    q = db.query(DbAuditLog).order_by(DbAuditLog.timestamp.desc())
    if action:
        q = q.filter(DbAuditLog.transaction_type == action)
    if entity_type:
        q = q.filter(DbAuditLog.source_type == entity_type)
    if entity_id:
        q = q.filter(DbAuditLog.source_id == entity_id)
    if request_id:
        q = q.filter(DbAuditLog.request_id == request_id)
    if actor:
        q = q.filter(DbAuditLog.actor == actor)
    rows = q.limit(800).all()
    out = []
    for row in rows:
        ts = row.timestamp or ""
        if date_from and ts < date_from:
            continue
        if date_to and ts[:10] > date_to[:10]:
            continue
        out.append(row)
    return out

# ═══════════════════════════════════════════════════════════════════════════════
# AGENT STEP RUNNER (legacy single workstream + multi)
# ═══════════════════════════════════════════════════════════════════════════════
@app.post("/api/requests/{request_id}/step")
def run_request_step(request_id: str, db: Session = Depends(get_db)):
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req: raise HTTPException(404, "Not found")

    if req.status == "DRAFT":
        dealer = db.query(DbDealer).filter(DbDealer.dealer_id == req.dealer_id).first()
        customer = db.query(DbCustomer).filter(DbCustomer.customer_id == req.customer_id).first()
        vehicle = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == req.vehicle_id).first()
        if not dealer or not customer or not vehicle:
            req.status = "EXCEPTION_HOLD"
            req.exception_reason = "Thiếu thông tin Master Data."
            db.commit()
            return {"status":"exception","detail":"Missing master data."}
        req.status = "STANDARDIZED"
        db.commit()
        return {"status":"success","detail":"✅ WF2 — Chuẩn hóa Đại lý, KH, Xe thành công."}

    elif req.status == "STANDARDIZED":
        cg = db.query(DbCuttingGroupMatrix).filter(
            DbCuttingGroupMatrix.vehicle_model_code == req.vehicle_model_code,
            DbCuttingGroupMatrix.material_code == req.material_code
        ).first()
        if cg:
            req.is_grouped_cut = True; req.cut_group_id = cg.cut_group_id
            req.planned_cut_block = f"{cg.cut_block_width_cm}x{int(cg.deduction_length_m*100)}"
            req.planned_deduction_length_m = cg.deduction_length_m
        else:
            req.is_grouped_cut = False; req.planned_cut_block = "152x150"
            req.planned_deduction_length_m = 1.65
        req.status = "NORM_ASSIGNED"
        db.commit()
        return {"status":"success","detail":"✅ WF3 — Ánh xạ định mức và nhận diện Cutting Group."}

    elif req.status == "NORM_ASSIGNED":
        # Try offcut matching
        length_needed = req.planned_deduction_length_m or 1.43
        best_offcut = db.query(DbOffcutInventory).filter(
            DbOffcutInventory.material_code == req.material_code,
            DbOffcutInventory.status == "ACTIVE",
            DbOffcutInventory.is_locked == False,
            DbOffcutInventory.width_m >= 1.51,
            DbOffcutInventory.length_m >= length_needed
        ).order_by(DbOffcutInventory.length_m.asc()).first()

        if req.request_id in ("REQ-20260603-001", "REQ-20260604-001"):
            req.allocated_source_type = "LOT"; req.allocated_source_id = "LOT-JB20-001"
        elif best_offcut:
            req.allocated_source_type = "OFFCUT"; req.allocated_source_id = best_offcut.offcut_id
        else:
            best_lot = db.query(DbLotInventory).filter(
                DbLotInventory.material_code == req.material_code,
                DbLotInventory.status == "ACTIVE",
                DbLotInventory.is_locked == False,
                DbLotInventory.remaining_length_m >= length_needed
            ).order_by(DbLotInventory.import_date.asc()).first()
            if not best_lot:
                req.status = "EXCEPTION_HOLD"
                req.exception_reason = f"STOCK_EXHAUSTED: Không đủ tồn kho cho {req.material_code}."
                db.commit()
                return {"status":"exception","detail":"Hết tồn kho khả dụng."}
            req.allocated_source_type = "LOT"; req.allocated_source_id = best_lot.lot_id

        req.status = "ALLOCATED"

        # Auto-create workstreams if multi-workstream request
        existing_ws = db.query(DbWorkstream).filter(
            DbWorkstream.request_id == req.request_id).count()
        if req.is_multi_workstream and existing_ws == 0:
            _create_workstreams_for_request(db, req)

        _add_notif(db, "🔔 Cần phê duyệt phương án",
                   f"Request {request_id} — Đề xuất {req.allocated_source_type}: {req.allocated_source_id}. Phê duyệt theo từng workstream.",
                   "APPROVAL_NEEDED", request_id, "REQUEST", "MANAGER")
        db.commit()
        return {"status":"success",
                "detail":"✅ WF4 — Đề xuất phân bổ vật tư. Đã tạo Workstream cards. Chờ Quản lý duyệt."}

    return {"status":"info","detail":"Không có bước tự động khả dụng."}


def _build_extra_cut_history_api(ws: DbWorkstream, db: Optional[Session] = None) -> list:
    """Danh sách đề xuất cắt thêm cho API (bổ sung roll_cut_summary từng snapshot WF)."""
    import copy

    from wf_allocation_service import compute_wf_roll_cut_summary, load_extra_cut_history

    rows = list(load_extra_cut_history(ws))
    if not rows and bool(getattr(ws, "extra_cut_requested", False)):
        if getattr(ws, "workstream_type", None) == "WINDOW_FILM_INSTALLATION":
            ex_raw = getattr(ws, "extra_cut_wf_allocation_json", None) or ""
            if ex_raw.strip():
                try:
                    ex_alloc = json.loads(ex_raw)
                except json.JSONDecodeError:
                    ex_alloc = None
                if isinstance(ex_alloc, dict) and (ex_alloc.get("items") or []):
                    rows = [
                        {
                            "proposal_id": "LEGACY-SNAPSHOT",
                            "requested_at": (getattr(ws, "created_at", None) or "") or "",
                            "actor_id": (getattr(ws, "assigned_technician_id", None) or "").strip(),
                            "actor_name": (getattr(ws, "assigned_technician_name", None) or "").strip(),
                            "reason": (getattr(ws, "extra_cut_reason", None) or "").strip(),
                            "wf_allocation": ex_alloc,
                        }
                    ]
        elif getattr(ws, "workstream_type", None) == "PPF_INSTALLATION":
            rows = [
                {
                    "proposal_id": "LEGACY-SNAPSHOT",
                    "requested_at": (getattr(ws, "created_at", None) or "") or "",
                    "actor_id": (getattr(ws, "assigned_technician_id", None) or "").strip(),
                    "actor_name": (getattr(ws, "assigned_technician_name", None) or "").strip(),
                    "reason": (getattr(ws, "extra_cut_reason", None) or "").strip(),
                }
            ]
    out = []
    for ent in rows:
        if not isinstance(ent, dict):
            continue
        e = copy.deepcopy(ent)
        wa = e.get("wf_allocation")
        if isinstance(wa, dict) and getattr(ws, "workstream_type", None) == "WINDOW_FILM_INSTALLATION":
            if not wa.get("roll_cut_summary"):
                wa["roll_cut_summary"] = compute_wf_roll_cut_summary(wa)
            e["wf_allocation"] = wa
        out.append(e)
    return out


def _serialize_workstream(ws: DbWorkstream, db: Optional[Session] = None) -> dict:
    d = ws.__dict__.copy()
    d.pop("_sa_instance_state", None)
    if ws.material_plan:
        try:
            d["material_plan"] = json.loads(ws.material_plan)
        except json.JSONDecodeError:
            pass
    if ws.workstream_type == "PPF_INSTALLATION":
        from ppf_allocation_service import build_default_ppf_allocation

        if getattr(ws, "ppf_allocation_json", None):
            try:
                d["ppf_allocation"] = json.loads(ws.ppf_allocation_json)
            except json.JSONDecodeError:
                d["ppf_allocation"] = build_default_ppf_allocation(ws)
        else:
            d["ppf_allocation"] = build_default_ppf_allocation(ws)
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION":
        from wf_allocation_service import build_default_wf_allocation, compute_wf_roll_cut_summary

        if getattr(ws, "wf_allocation_json", None):
            try:
                wf_alloc = json.loads(ws.wf_allocation_json)
            except json.JSONDecodeError:
                wf_alloc = build_default_wf_allocation(db, ws) if db else {"items": [], "workstream_id": ws.workstream_id}
        else:
            wf_alloc = build_default_wf_allocation(db, ws) if db else {"items": [], "workstream_id": ws.workstream_id}
        if isinstance(wf_alloc, dict) and not wf_alloc.get("roll_cut_summary"):
            wf_alloc["roll_cut_summary"] = compute_wf_roll_cut_summary(wf_alloc)
        d["wf_allocation"] = wf_alloc
        ex_raw = getattr(ws, "extra_cut_wf_allocation_json", None) or ""
        if ex_raw.strip():
            try:
                ex_alloc = json.loads(ex_raw)
            except json.JSONDecodeError:
                ex_alloc = {}
            if isinstance(ex_alloc, dict) and not ex_alloc.get("roll_cut_summary"):
                ex_alloc["roll_cut_summary"] = compute_wf_roll_cut_summary(ex_alloc)
            d["extra_cut_wf_allocation"] = ex_alloc
        else:
            d["extra_cut_wf_allocation"] = None
        d["extra_cut_history"] = _build_extra_cut_history_api(ws, db)
    else:
        d["extra_cut_history"] = _build_extra_cut_history_api(ws, db)
    d.pop("ppf_allocation_json", None)
    d.pop("wf_allocation_json", None)
    d.pop("extra_cut_wf_allocation_json", None)
    d.pop("extra_cut_history_json", None)
    if db and getattr(ws, "request_id", None):
        try:
            req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
            if req:
                if getattr(req, "requested_delivery_time", None):
                    d["requested_delivery_time"] = req.requested_delivery_time
                else:
                    d["requested_delivery_time"] = None
                d["request_created_at"] = getattr(req, "created_at", None) or None
            else:
                d["requested_delivery_time"] = None
                d["request_created_at"] = None
        except Exception:
            d["requested_delivery_time"] = None
            d["request_created_at"] = None
    else:
        d["requested_delivery_time"] = None
        d["request_created_at"] = None
    return d


# ═══════════════════════════════════════════════════════════════════════════════
# WORKSTREAM APIs
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/workstreams")
def get_all_workstreams(db: Session = Depends(get_db)):
    wss = db.query(DbWorkstream).order_by(DbWorkstream.created_at.desc()).all()
    return [_serialize_workstream(ws, db) for ws in wss]

@app.get("/api/workstreams/{ws_id}")
def get_workstream(ws_id: str, db: Session = Depends(get_db)):
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    return _serialize_workstream(ws, db)


@app.get("/api/workstreams/{ws_id}/allocation-material-codes")
def get_workstream_allocation_material_codes(ws_id: str, db: Session = Depends(get_db)):
    """Mã vật tư theo phân bổ đã phê duyệt (WF/PPF) — dùng picker mảnh dư / thực tế, không phải full danh sách kho."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    codes = approved_allocation_material_codes(ws)
    return {"material_codes": codes, "workstream_id": ws_id, "workstream_type": ws.workstream_type}


@app.put("/api/workstreams/{ws_id}/ppf-allocation")
def put_ppf_allocation_route(ws_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Lưu proposal phân bổ PPF nhiều nguồn (trước duyệt). Không trừ kho."""
    from ppf_allocation_service import (
        put_ppf_allocation,
        audit_ppf_allocation_save,
        build_default_ppf_allocation,
    )

    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    prev_raw = getattr(ws, "ppf_allocation_json", None) or ""
    prev_snap = {}
    if prev_raw:
        try:
            prev_snap = json.loads(prev_raw)
        except json.JSONDecodeError:
            prev_snap = {}
    if not prev_snap:
        prev_snap = build_default_ppf_allocation(ws)
    prev_type = ws.selected_material_code or prev_snap.get("ppf_type")

    out = put_ppf_allocation(db, ws_id, data, actor=data.get("actor", "QL-002"))
    for fld in ("technician_team", "assigned_technician_id", "assigned_technician_name"):
        if fld in data and data.get(fld) is not None:
            setattr(ws, fld, data.get(fld))
    new_raw = ws.ppf_allocation_json or "{}"
    try:
        new_snap = json.loads(new_raw)
    except json.JSONDecodeError:
        new_snap = {}

    new_type = (new_snap.get("ppf_type") or "").strip()
    old_type = (prev_snap.get("ppf_type") or prev_type or "").strip()
    if new_type and old_type and new_type != old_type:
        _audit(
            db,
            ws.request_id,
            "PPF_TYPE_CHANGED",
            "WORKSTREAM",
            ws_id,
            old_type,
            new_type,
            data.get("change_reason") or "PUT ppf-allocation",
            data.get("actor", "QL-002"),
            ws_id,
            ws.workstream_type,
        )

    def _full_item(snap):
        return next((x for x in (snap.get("items") or []) if x.get("item_code") == "FULL_VEHICLE_PPF"), {})

    fp, fn = _full_item(prev_snap), _full_item(new_snap)
    if (fn.get("planned_cut_block") or "") != (fp.get("planned_cut_block") or "") or abs(
        float(fn.get("required_length_m") or 0) - float(fp.get("required_length_m") or 0)
    ) > 1e-5:
        _audit(
            db,
            ws.request_id,
            "PPF_SIZE_OVERRIDDEN",
            "WORKSTREAM",
            ws_id,
            json.dumps({"block": fp.get("planned_cut_block"), "req_m": fp.get("required_length_m")}, ensure_ascii=False),
            json.dumps({"block": fn.get("planned_cut_block"), "req_m": fn.get("required_length_m")}, ensure_ascii=False),
            data.get("change_reason") or "Chỉnh kích thước / chiều dài PPF",
            data.get("actor", "QL-002"),
            ws_id,
            ws.workstream_type,
        )

    prev_codes = {x.get("item_code") for x in (prev_snap.get("items") or []) if x.get("is_selected")}
    for it in new_snap.get("items") or []:
        code = it.get("item_code")
        if it.get("is_selected") and code and code not in prev_codes and code != "FULL_VEHICLE_PPF":
            _audit(
                db,
                ws.request_id,
                "PPF_ITEM_ADDED",
                "WORKSTREAM",
                ws_id,
                "not_selected",
                code,
                data.get("change_reason") or "Thêm hạng mục PPF",
                data.get("actor", "QL-002"),
                ws_id,
                ws.workstream_type,
            )

    prev_ns = sum(len((x.get("sources") or [])) for x in (prev_snap.get("items") or []) if x.get("is_selected"))
    new_ns = sum(len((x.get("sources") or [])) for x in (new_snap.get("items") or []) if x.get("is_selected"))
    if prev_raw.strip() and new_ns > prev_ns:
        _audit(
            db,
            ws.request_id,
            "PPF_SOURCE_SPLIT",
            "WORKSTREAM",
            ws_id,
            str(prev_ns),
            str(new_ns),
            data.get("change_reason") or "Chia thêm nguồn PPF",
            data.get("actor", "QL-002"),
            ws_id,
            ws.workstream_type,
        )

    audit_ppf_allocation_save(
        db,
        ws,
        prev_raw,
        new_raw,
        data.get("change_reason") or "",
        data.get("actor", "QL-002"),
        lambda rid, tt, st, sid, bv, av, r, act, ws_id_a, ws_type_a: _audit(
            db, rid, tt, st, sid, bv, av, r, act, ws_id_a, ws_type_a
        ),
    )
    db.commit()
    return out


def _put_wf_allocation_route(ws_id: str, data: dict, db: Session):
    """Lưu proposal phân bổ Window Film (nhiều hạng mục + nguồn). Không trừ kho."""
    from wf_allocation_service import put_wf_allocation, build_default_wf_allocation

    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    prev_raw = getattr(ws, "wf_allocation_json", None) or ""
    prev_snap: dict = {}
    if prev_raw:
        try:
            prev_snap = json.loads(prev_raw)
        except json.JSONDecodeError:
            prev_snap = {}
    if not prev_snap:
        prev_snap = build_default_wf_allocation(db, ws)

    out = put_wf_allocation(db, ws_id, data, actor=data.get("actor", "QL-002"))
    for fld in ("technician_team", "assigned_technician_id", "assigned_technician_name"):
        if fld in data and data.get(fld) is not None:
            setattr(ws, fld, data.get(fld))
    new_raw = ws.wf_allocation_json or "{}"
    try:
        new_snap = json.loads(new_raw)
    except json.JSONDecodeError:
        new_snap = {}

    old_items = {x.get("item_code"): x for x in (prev_snap.get("items") or [])}
    for it in new_snap.get("items") or []:
        code = it.get("item_code")
        o = old_items.get(code) or {}
        if it.get("is_selected") and o.get("material_code") and (it.get("material_code") or "") != (o.get("material_code") or ""):
            _audit(
                db,
                ws.request_id,
                "REQUEST_MATERIAL_OVERRIDDEN",
                "WORKSTREAM",
                ws_id,
                str(o.get("material_code") or ""),
                str(it.get("material_code") or ""),
                data.get("change_reason") or "PUT allocation WF",
                data.get("actor", "QL-002"),
                ws_id,
                ws.workstream_type,
            )

    prev_ns = sum(len((x.get("sources") or [])) for x in (prev_snap.get("items") or []) if x.get("is_selected"))
    new_ns = sum(len((x.get("sources") or [])) for x in (new_snap.get("items") or []) if x.get("is_selected"))
    if prev_raw.strip() and new_ns > prev_ns:
        _audit(
            db,
            ws.request_id,
            "WINDOW_FILM_SOURCE_SPLIT",
            "WORKSTREAM",
            ws_id,
            str(prev_ns),
            str(new_ns),
            data.get("change_reason") or "Chia thêm nguồn WF",
            data.get("actor", "QL-002"),
            ws_id,
            ws.workstream_type,
        )

    _audit(
        db,
        ws.request_id,
        "WORKSTREAM_ALLOCATION_UPDATED",
        "WORKSTREAM",
        ws_id,
        (prev_raw or "")[:2000],
        (new_raw or "")[:2000],
        data.get("change_reason") or "Cập nhật phân bổ WF trước duyệt",
        data.get("actor", "QL-002"),
        ws_id,
        ws.workstream_type,
    )
    db.commit()
    return out


@app.put("/api/workstreams/{ws_id}/allocation")
def put_workstream_allocation_unified(ws_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """API chung PPF + Phim cách nhiệt — UI ưu tiên endpoint này."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    wt = (data.get("workstream_type") or ws.workstream_type or "").strip()
    if wt != ws.workstream_type:
        raise HTTPException(
            400,
            detail={"error": "WORKSTREAM_TYPE_MISMATCH", "message": "workstream_type trong body không khớp workstream."},
        )
    if ws.workstream_type == "PPF_INSTALLATION":
        body = dict(data)
        if not body.get("ppf_type"):
            full = next((x for x in (body.get("items") or []) if x.get("item_code") == "FULL_VEHICLE_PPF"), {})
            body["ppf_type"] = (full.get("material_code") or ws.selected_material_code or "T-TYPE").strip()
        return put_ppf_allocation_route(ws_id, body, db)
    return _put_wf_allocation_route(ws_id, data, db)


@app.post("/api/workstreams/{ws_id}/approve-wf-materials")
def approve_wf_materials_only(ws_id: str, data: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    """
    Bước 1 (Phim cách nhiệt): Quản lý xác nhận mã phim từng hạng mục.
    → PENDING_TECH_PREFLIGHT, rebuild wf_allocation từ định mức + material_plan (chưa khóa LOT, chưa tạo Job Card).
    """
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    if ws.workstream_type != "WINDOW_FILM_INSTALLATION":
        raise HTTPException(400, {"error": "INVALID", "message": "Chỉ áp dụng cho WINDOW_FILM_INSTALLATION."})
    if ws.status != "PENDING_APPROVAL":
        raise HTTPException(
            400,
            {"error": "INVALID", "message": f"Chỉ duyệt mã phim khi PENDING_APPROVAL. Hiện: {ws.status}."},
        )
    reason = (data.get("reason") or data.get("change_reason") or "").strip()
    if not reason:
        raise HTTPException(400, {"error": "REASON_REQUIRED", "message": "Bắt buộc nhập reason (xác nhận lựa chọn mã phim thi công)."})
    actor = (data.get("approved_by") or data.get("updated_by") or "QL-002").strip()

    plan_in = data.get("material_plan")
    if plan_in is not None:
        if not isinstance(plan_in, list):
            raise HTTPException(400, {"error": "INVALID", "message": "material_plan phải là mảng."})
        ws.material_plan = json.dumps(plan_in, ensure_ascii=False)
    elif not (ws.material_plan or "").strip():
        raise HTTPException(400, {"error": "INVALID", "message": "Thiếu material_plan trên workstream."})

    from wf_allocation_service import build_default_wf_allocation

    alloc = build_default_wf_allocation(db, ws)
    ws.wf_allocation_json = json.dumps(alloc, ensure_ascii=False)
    first_sel = next((x for x in (alloc.get("items") or []) if x.get("is_selected")), None)
    if first_sel:
        srcs = first_sel.get("sources") or []
        if srcs:
            ws.allocated_source_type = (srcs[0].get("source_type") or "LOT").upper()
            ws.allocated_source_id = srcs[0].get("source_id") or ""
        ws.selected_material_code = first_sel.get("material_code") or ws.selected_material_code
        ws.planned_cut_block = first_sel.get("planned_size") or ws.planned_cut_block
        ws.planned_deduction_length_m = float(first_sel.get("required_length_m") or ws.planned_deduction_length_m or 0)

    before_st = ws.status
    ws.status = "PENDING_TECH_PREFLIGHT"
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req:
        _update_request_status_from_workstreams(db, req)
    _audit(
        db,
        ws.request_id,
        "WF_MATERIAL_PLAN_APPROVED",
        "WORKSTREAM",
        ws_id,
        before_st,
        "PENDING_TECH_PREFLIGHT",
        reason,
        actor,
        ws_id,
        ws.workstream_type,
    )
    db.commit()
    db.refresh(ws)
    return {
        "status": "success",
        "detail": "Đã duyệt mã phim thi công. KTV chỉnh phân bổ LOT rồi bấm Chốt phân bổ.",
        "workstream_id": ws_id,
        "new_status": ws.status,
        "wf_allocation": json.loads(ws.wf_allocation_json) if ws.wf_allocation_json else alloc,
    }


@app.post("/api/workstreams/{ws_id}/approve")
def approve_workstream(ws_id: str, data: dict = None, db: Session = Depends(get_db)):
    """Manager approves a single workstream → Soft Lock + Job Card created."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION":
        if ws.status not in ("PENDING_TECH_PREFLIGHT",):
            raise HTTPException(
                400,
                detail={
                    "error": "WF_APPROVAL_WRONG_STEP",
                    "message": (
                        f"Phim cách nhiệt: trước hết duyệt mã phim (POST /api/workstreams/{ws_id}/approve-wf-materials). "
                        f"Trạng thái hiện: {ws.status}"
                    ),
                },
            )
    elif ws.status not in ("PENDING_APPROVAL",):
        raise HTTPException(400, f"Workstream in wrong status: {ws.status}")

    data = data or {}
    # Đổi mã vật tư / loại PPF trước khi duyệt — bắt buộc change_reason
    new_mat = data.get("selected_material_code")
    if new_mat and str(new_mat).strip() != str(ws.selected_material_code or "").strip():
        reason = (data.get("change_reason") or "").strip()
        if not reason:
            raise HTTPException(
                400,
                "Bắt buộc nhập change_reason khi đổi mã vật tư (Window Film) hoặc loại PPF.",
            )
        old_m = ws.selected_material_code
        if ws.workstream_type == "PPF_INSTALLATION":
            _audit(db, ws.request_id, "PPF_TYPE_CHANGED", "WORKSTREAM", ws_id,
                   old_m, new_mat, reason, "QL-002",
                   ws_id, ws.workstream_type)
            ws.ppf_type_changed = True
            ws.ppf_type_change_reason = reason
        elif ws.workstream_type == "WINDOW_FILM_INSTALLATION":
            _audit(db, ws.request_id, "REQUEST_MATERIAL_OVERRIDDEN", "WORKSTREAM", ws_id,
                   old_m, new_mat, reason, "QL-002",
                   ws_id, ws.workstream_type)
        ws.selected_material_code = new_mat

    # Handle source change
    new_source_id = data.get("allocated_source_id")
    new_source_type = data.get("allocated_source_type")
    if new_source_id and new_source_id != ws.allocated_source_id:
        reason = data.get("change_reason", "")
        if not reason: raise HTTPException(400, "Bắt buộc nhập reason khi đổi LOT/OFFCUT.")
        _audit(db, ws.request_id, "WORKSTREAM_SOURCE_CHANGED", new_source_type or "LOT", new_source_id,
               ws.allocated_source_id or "None", new_source_id, reason, "QL-002",
               ws_id, ws.workstream_type)
        ws.allocated_source_type = new_source_type or ws.allocated_source_type
        ws.allocated_source_id = new_source_id
        ws.source_changed = True; ws.source_change_reason = reason

    # Determine source for this workstream if not set
    if not ws.allocated_source_id:
        mat = ws.selected_material_code or "JB20"
        lot = db.query(DbLotInventory).filter(
            DbLotInventory.material_code == mat,
            DbLotInventory.status == "ACTIVE",
            DbLotInventory.is_locked == False,
            DbLotInventory.remaining_length_m >= (ws.planned_deduction_length_m or 1.0)
        ).order_by(DbLotInventory.import_date.asc()).first()
        if lot:
            ws.allocated_source_type = "LOT"; ws.allocated_source_id = lot.lot_id
        else:
            ws.allocated_source_type = "LOT"
            ws.allocated_source_id = f"LOT-{mat}-001"

    approver = data.get("approved_by", "QL-002")

    from ppf_allocation_service import validate_ppf_allocation_at_approve

    if ws.workstream_type == "PPF_INSTALLATION":
        validate_ppf_allocation_at_approve(db, ws)
    elif ws.workstream_type == "WINDOW_FILM_INSTALLATION":
        from wf_allocation_service import validate_wf_allocation_at_approve

        validate_wf_allocation_at_approve(db, ws)

    used_ppf_multi_lock = False
    ppf_json = getattr(ws, "ppf_allocation_json", None)
    if ws.workstream_type == "PPF_INSTALLATION" and ppf_json:
        try:
            _alloc_chk = json.loads(ppf_json)
        except json.JSONDecodeError:
            _alloc_chk = {}
        if _alloc_chk.get("items"):
            from ppf_allocation_service import soft_lock_ppf_allocation_sources

            n_lock = soft_lock_ppf_allocation_sources(db, ws, approver, lambda *args: _audit(db, *args))
            if n_lock > 0:
                used_ppf_multi_lock = True

    used_wf_multi_lock = False
    wf_json = getattr(ws, "wf_allocation_json", None)
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and wf_json:
        try:
            _wf_chk = json.loads(wf_json)
        except json.JSONDecodeError:
            _wf_chk = {}
        if _wf_chk.get("items"):
            from wf_allocation_service import soft_lock_wf_allocation_sources

            n_wf = soft_lock_wf_allocation_sources(db, ws, approver, lambda *args: _audit(db, *args))
            if n_wf > 0:
                used_wf_multi_lock = True

    if not used_ppf_multi_lock and not used_wf_multi_lock:
        if ws.allocated_source_type == "LOT":
            lot = db.query(DbLotInventory).filter(
                DbLotInventory.lot_id == ws.allocated_source_id).first()
            if lot:
                lot.is_locked = True
                lot.locked_by_request_id = ws.request_id
                lot.locked_by_workstream_id = ws.workstream_id
        elif ws.allocated_source_type == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(
                DbOffcutInventory.offcut_id == ws.allocated_source_id).first()
            if oc:
                oc.is_locked = True
                oc.locked_by_request_id = ws.request_id
                oc.locked_by_workstream_id = ws.workstream_id
    ws.is_locked = True
    ws.status = "APPROVED"
    ws.approved_by = approver
    ws.approved_at = _now()

    _audit(db, ws.request_id, "WORKSTREAM_APPROVED",
           ws.allocated_source_type or "LOT", ws.allocated_source_id or "—",
           "PENDING_APPROVAL", "APPROVED",
           f"Quản lý {ws.approved_by} phê duyệt {ws.workstream_type}",
           ws.approved_by, ws_id, ws.workstream_type)
    if not used_ppf_multi_lock and not used_wf_multi_lock:
        _audit(db, ws.request_id, "SOFT_LOCK_RECORDED",
               ws.allocated_source_type or "LOT", ws.allocated_source_id or "—",
               "is_locked=false", "is_locked=true",
               f"Soft Lock {ws.workstream_type} sau phê duyệt",
               ws.approved_by, ws_id, ws.workstream_type)

    # Create Job Card
    today = datetime.date.today().strftime("%Y%m%d")
    prefix = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "WF"
    jc_id = f"JOB-{prefix}-{today}-{ws.request_id[-3:]}"
    existing_jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == jc_id).first()
    if not existing_jc:
        req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
        jc = DbJobCard(
            job_card_id=jc_id, request_id=ws.request_id,
            workstream_id=ws_id, workstream_type=ws.workstream_type,
            technician_id=ws.assigned_technician_id,
            technician_name=ws.assigned_technician_name,
            technician_team=ws.technician_team,
            vehicle_model_code=ws.workstream_type,
            material_code=ws.selected_material_code,
            job_items=ws.workstream_type,
            planned_cut_block=ws.planned_cut_block,
            planned_deduction_length_m=ws.planned_deduction_length_m,
            allocated_source_id=ws.allocated_source_id,
            status="PENDING", actual_confirmation_status="PENDING",
            requested_delivery_time=(req.requested_delivery_time if req else
                (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).isoformat() + "Z"),
            created_at=_now()
        )
        db.add(jc)
        ws.job_card_id = jc_id

    # Update parent request status
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req: _update_request_status_from_workstreams(db, req)

    team_label = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "Window Film"
    _add_notif(db, f"✅ {team_label} workstream được duyệt",
               f"Job Card {jc_id} tạo thành công. Đội {ws.technician_team} nhận lệnh thi công.",
               f"{'PPF' if 'PPF' in ws.workstream_type else 'WF'}_JOB_ASSIGNED",
               jc_id, "JOB_CARD", "TECHNICIAN",
               ws_id, ws.workstream_type, ws.team_type)
    db.commit()
    return {"status":"success",
            "detail":f"✅ Phê duyệt {ws.workstream_type} thành công. Job Card {jc_id} đã tạo.",
            "job_card_id": jc_id}

@app.post("/api/workstreams/{ws_id}/edit")
def edit_workstream(ws_id: str, data: dict, db: Session = Depends(get_db)):
    """Edit workstream fields — all changes require reason + audit log."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.status == "CLOSED":
        raise HTTPException(400, "Cannot edit CLOSED workstream (use Admin Override).")
    reason = data.get("reason", "")
    if not reason: raise HTTPException(400, "Bắt buộc nhập reason cho mọi chỉnh sửa.")
    actor = data.get("actor", "QL-002")

    editable = ["selected_material_code","planned_cut_block","planned_deduction_length_m",
                "allocated_source_id","allocated_source_type","technician_team",
                "assigned_technician_id","assigned_technician_name"]
    for field in editable:
        if field in data:
            old = getattr(ws, field, None)
            new = data[field]
            if str(old) != str(new):
                _audit(db, ws.request_id, f"WORKSTREAM_EDIT_{field.upper()}",
                       "WORKSTREAM", ws_id, str(old), str(new), reason, actor,
                       ws_id, ws.workstream_type)
                setattr(ws, field, new)

    db.commit()
    return {"status":"success","detail":f"Workstream {ws_id} đã được cập nhật."}

@app.post("/api/workstreams/{ws_id}/start")
def start_workstream(ws_id: str, db: Session = Depends(get_db)):
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.status not in ("APPROVED","ASSIGNED_TO_TECHNICIAN"):
        raise HTTPException(400, f"Workstream phải ở APPROVED để bắt đầu. Hiện: {ws.status}")
    ws.status = "IN_PROGRESS"
    ws.started_at = _now()

    # Update Job Card
    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc: jc.status = "IN_PROGRESS"; jc.started_at = ws.started_at

    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req: _update_request_status_from_workstreams(db, req)

    team = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "Window Film"
    _add_notif(db, f"🔧 Đội {team} bắt đầu thi công",
               f"Workstream {ws_id} — Đội {ws.technician_team} bắt đầu lúc {ws.started_at[:16]}Z.",
               f"{'PPF' if 'PPF' in ws.workstream_type else 'WF'}_TEAM_STARTED",
               ws_id, "JOB_CARD", "MANAGER",
               ws_id, ws.workstream_type, ws.team_type)
    db.commit()
    return {"status":"success","detail":f"✅ Bắt đầu thi công {ws.workstream_type} lúc {ws.started_at[:16]}Z."}

@app.post("/api/workstreams/{ws_id}/submit-actual")
def submit_actual(ws_id: str, data: dict, db: Session = Depends(get_db)):
    """KTV submits actual measurements. Sets actual_confirmation_status = COMPLETED."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")

    ws.actual_cut_block = data.get("actual_cut_block", ws.planned_cut_block)
    ws.actual_width_m = float(data.get("actual_width_m", 1.52))
    ws.actual_length_m = float(data.get("actual_length_m", ws.planned_deduction_length_m or 0))
    ws.actual_area_m2 = round(ws.actual_width_m * ws.actual_length_m, 3)
    ws.has_new_offcut = bool(data.get("has_new_offcut", False))
    ws.offcut_width_m = float(data.get("offcut_width_m", 0.0)) if ws.has_new_offcut else 0.0
    ws.offcut_length_m = float(data.get("offcut_length_m", 0.0)) if ws.has_new_offcut else 0.0
    ws.offcut_quality_status = data.get("offcut_quality_status", "NORMAL")
    ws.offcut_storage_location = data.get("offcut_storage_location", "OFFCUT-RACK-C")
    if ws.has_new_offcut:
        ocm = (data.get("offcut_material_code") or "").strip()
        ws.offcut_material_code = ocm if ocm else None
    else:
        ws.offcut_material_code = None
    # Đăng ký cắt thêm: dùng POST /extra-cut-request (giữa ca), không gộp vào submit-actual.
    ws.has_scrap = bool(data.get("has_scrap", False))
    ws.scrap_area_m2 = float(data.get("scrap_area_m2", 0.0)) if ws.has_scrap else 0.0
    ws.technician_note = data.get("technician_note", "")
    ws.actual_confirmation_status = "COMPLETED"

    # Update job card confirmation
    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc: jc.actual_confirmation_status = "COMPLETED"

    db.commit()
    return {"status":"success",
            "detail":f"✅ Xác nhận kích thước thực tế {ws.workstream_type} thành công. Sẵn sàng Complete."}


@app.post("/api/workstreams/{ws_id}/extra-cut-request")
def post_extra_cut_request(ws_id: str, data: dict, db: Session = Depends(get_db)):
    """KTV đăng ký cắt thêm giữa ca (IN_PROGRESS / chờ nhập thực tế), tách khỏi form hoàn tất."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    if ws.status not in ("IN_PROGRESS", "ACTUAL_CONFIRMATION_REQUIRED"):
        raise HTTPException(
            400,
            {
                "error": "INVALID",
                "message": f"Chỉ đăng ký khi luồng đang thi công hoặc chờ nhập thực tế. Hiện: {ws.status}.",
            },
        )
    reason = (data.get("reason") or "").strip()
    if len(reason) < 5:
        raise HTTPException(
            400,
            {
                "error": "INVALID",
                "message": "Nhập lý do tối thiểu 5 ký tự (VD: gãy phim khi vận chuyển).",
            },
        )
    actor_id = (data.get("technician_id") or ws.assigned_technician_id or "KTV-UNKNOWN").strip()
    actor_name = (data.get("technician_name") or ws.assigned_technician_name or "").strip()
    team_label = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "Window Film"

    from datetime import datetime, timezone

    from wf_allocation_service import (
        _normalize_wf_body,
        prior_extra_cut_entries_include_legacy,
        validate_wf_extra_cut_allocation,
    )

    extra_norm = None
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION":
        body_wf = data.get("wf_extra_allocation") or data.get("wf_allocation")
        if not isinstance(body_wf, dict) or not isinstance(body_wf.get("items"), list):
            raise HTTPException(
                400,
                {
                    "error": "INVALID",
                    "message": "Phim cách nhiệt: gửi kèm wf_extra_allocation (items giống phân bổ LOT).",
                },
            )
        body_wf = dict(body_wf)
        body_wf["change_reason"] = reason[:2000]
        extra_norm = _normalize_wf_body(body_wf, ws)
        validate_wf_extra_cut_allocation(db, ws, extra_norm)
        ws.extra_cut_wf_allocation_json = json.dumps(extra_norm, ensure_ascii=False)
    else:
        ws.extra_cut_wf_allocation_json = None

    history_for_save = prior_extra_cut_entries_include_legacy(ws)
    proposal_id = f"ECP-{uuid.uuid4().hex[:12]}"
    new_entry = {
        "proposal_id": proposal_id,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "actor_id": actor_id,
        "actor_name": actor_name,
        "reason": reason[:2000],
    }
    if isinstance(extra_norm, dict) and (extra_norm.get("items") or []):
        new_entry["wf_allocation"] = extra_norm
    history_for_save.append(new_entry)
    ws.extra_cut_history_json = json.dumps(history_for_save, ensure_ascii=False)

    ws.extra_cut_requested = True
    ws.extra_cut_reason = reason
    _audit(
        db,
        ws.request_id,
        "EXTRA_CUT_REGISTERED",
        "WORKSTREAM",
        ws_id,
        "—",
        json.dumps(
            {"proposal_id": proposal_id, "reason": reason[:500], "actor_id": actor_id, "actor_name": actor_name},
            ensure_ascii=False,
        ),
        "KTV đăng ký cắt thêm (lưu lịch sử từng lần: thời điểm + người + phân bổ WF nếu có).",
        actor_id,
        ws_id,
        ws.workstream_type,
    )
    _add_notif(
        db,
        f"📋 KTV đăng ký cắt thêm — {team_label}",
        f"{ws_id}: {reason[:300]}{'…' if len(reason) > 300 else ''}",
        "EXTRA_CUT_REQUEST",
        ws_id,
        "WORKSTREAM",
        "MANAGER",
        ws_id,
        ws.workstream_type,
        ws.team_type,
    )
    db.commit()
    out = {
        "status": "success",
        "detail": "Đã gửi đăng ký cắt thêm. Quản lý sẽ xử lý.",
        "extra_cut_requested": True,
        "extra_cut_reason": reason,
    }
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and ws.extra_cut_wf_allocation_json:
        try:
            out["extra_cut_wf_allocation"] = json.loads(ws.extra_cut_wf_allocation_json)
        except json.JSONDecodeError:
            out["extra_cut_wf_allocation"] = None
    out["extra_cut_history"] = _build_extra_cut_history_api(ws, db)
    return out


@app.delete("/api/workstreams/{ws_id}/extra-cut-proposals/{proposal_id}")
def delete_extra_cut_proposal(
    ws_id: str,
    proposal_id: str,
    actor: str = Query(None, description="Mã KTV thực hiện (mặc định KTV phụ trách luồng)"),
    db: Session = Depends(get_db),
):
    """KTV xóa một đợt đề xuất cắt thêm; hệ thống đồng bộ lại snapshot cuối và tổng kiểm tồn."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workstream not found")
    if ws.status not in ("IN_PROGRESS", "ACTUAL_CONFIRMATION_REQUIRED"):
        raise HTTPException(
            400,
            {
                "error": "INVALID",
                "message": f"Chỉ xóa đợt đề xuất khi luồng đang thi công hoặc chờ nhập thực tế. Hiện: {ws.status}.",
            },
        )
    pid = (proposal_id or "").strip()
    if not pid:
        raise HTTPException(400, {"error": "INVALID", "message": "Thiếu proposal_id."})

    from wf_allocation_service import load_extra_cut_history, sync_extra_cut_latest_snapshot

    actor_id = (actor or ws.assigned_technician_id or "KTV-UNKNOWN").strip()

    hist_db = load_extra_cut_history(ws)

    # Bản ghi cũ / API tổng hợp: chỉ có snapshot, chưa có mảng history trên DB
    if not hist_db and pid in ("LEGACY-SNAPSHOT", "MIGRATED-PRE-HISTORY-V1") and bool(getattr(ws, "extra_cut_requested", False)):
        ws.extra_cut_wf_allocation_json = None
        ws.extra_cut_history_json = None
        ws.extra_cut_reason = None
        ws.extra_cut_requested = False
        _audit(
            db,
            ws.request_id,
            "EXTRA_CUT_PROPOSAL_REMOVED",
            "WORKSTREAM",
            ws_id,
            pid,
            "—",
            "Xóa đợt cắt thêm (snapshot legacy, không có lịch sử JSON).",
            actor_id,
            ws_id,
            ws.workstream_type,
        )
        db.commit()
        return {
            "status": "success",
            "detail": "Đã xóa đăng ký cắt thêm.",
            "extra_cut_requested": False,
            "extra_cut_history": _build_extra_cut_history_api(ws, db),
            "extra_cut_wf_allocation": None,
        }

    new_hist = [e for e in hist_db if isinstance(e, dict) and (e.get("proposal_id") or "").strip() != pid]
    if len(new_hist) == len(hist_db):
        raise HTTPException(
            404,
            {"error": "NOT_FOUND", "message": f"Không tìm thấy đợt đề xuất: {pid}"},
        )

    ws.extra_cut_history_json = json.dumps(new_hist, ensure_ascii=False) if new_hist else None
    sync_extra_cut_latest_snapshot(ws)

    _audit(
        db,
        ws.request_id,
        "EXTRA_CUT_PROPOSAL_REMOVED",
        "WORKSTREAM",
        ws_id,
        pid,
        f"Còn {len(new_hist)} đợt" if new_hist else "—",
        "KTV xóa một đợt đề xuất cắt thêm; đã đồng bộ lại snapshot & tổng tích lũy.",
        actor_id,
        ws_id,
        ws.workstream_type,
    )
    db.commit()
    out = {
        "status": "success",
        "detail": "Đã xóa đợt đề xuất. Tổng kiểm tồn / trừ kho khi hoàn tất tính lại theo các đợt còn lại.",
        "extra_cut_requested": bool(ws.extra_cut_requested),
        "extra_cut_reason": ws.extra_cut_reason,
        "extra_cut_history": _build_extra_cut_history_api(ws, db),
    }
    if ws.workstream_type == "WINDOW_FILM_INSTALLATION" and getattr(ws, "extra_cut_wf_allocation_json", None):
        try:
            out["extra_cut_wf_allocation"] = json.loads(ws.extra_cut_wf_allocation_json)
        except json.JSONDecodeError:
            out["extra_cut_wf_allocation"] = None
    else:
        out["extra_cut_wf_allocation"] = None
    return out


@app.post("/api/workstreams/{ws_id}/cancel")
def cancel_workstream(ws_id: str, data: dict = None, db: Session = Depends(get_db)):
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.status in ("CLOSED", "COMPLETED", "CANCELLED"):
        raise HTTPException(400, f"Không thể hủy luồng ở trạng thái: {ws.status}")

    reason = (data or {}).get("reason", "Hủy theo yêu cầu")
    actor = (data or {}).get("actor", "QL-002")

    _audit(db, ws.request_id, "WORKSTREAM_CANCELLED", "WORKSTREAM", ws_id,
           ws.status, "CANCELLED", reason, actor, ws_id, getattr(ws, "workstream_type", ""))

    ws.status = "CANCELLED"

    # Free soft locks
    from database import DbLotInventory, DbOffcutInventory, DbJobCard
    lot_locks = db.query(DbLotInventory).filter(DbLotInventory.locked_by_workstream_id == ws_id).all()
    for l in lot_locks:
        l.is_locked = False
        l.locked_by_request_id = None
        l.locked_by_workstream_id = None

    offcut_locks = db.query(DbOffcutInventory).filter(DbOffcutInventory.locked_by_workstream_id == ws_id).all()
    for o in offcut_locks:
        o.is_locked = False
        o.locked_by_request_id = None
        o.locked_by_workstream_id = None

    # Update Job Card
    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc:
            jc.status = "CANCELLED"

    # Update Request Status
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req:
        _update_request_status_from_workstreams(db, req)

    db.commit()
    return {"status": "success", "detail": "Đã hủy luồng thi công."}

@app.post("/api/workstreams/{ws_id}/complete")
def complete_workstream(ws_id: str, data: dict = None, db: Session = Depends(get_db)):
    """KTV completes workstream → commit inventory → close workstream → check request closure."""
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.status not in ("IN_PROGRESS","ACTUAL_CONFIRMATION_REQUIRED"):
        raise HTTPException(400, f"Workstream phải ở IN_PROGRESS. Hiện: {ws.status}")
    if ws.actual_confirmation_status != "COMPLETED":
        ws.status = "ACTUAL_CONFIRMATION_REQUIRED"
        db.commit()
        return {"status":"info",
                "detail":"⚠️ KTV chưa nhập xác nhận kích thước thực tế. Hệ thống giữ ACTUAL_CONFIRMATION_REQUIRED."}

    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc and len(_job_completion_photos_list(jc)) < 1:
            return {
                "status": "info",
                "detail": "⚠️ Cần ít nhất 1 ảnh hoàn thành (nút «Hình ảnh hoàn thành» trên lệnh thi công) trước khi hệ thống trừ kho ảo và đóng luồng.",
            }

    tech_id = (data or {}).get("technician_id", ws.assigned_technician_id or "KTV-003")

    assert_source_valid_for_wf6_commit(db, ws)

    # Commit inventory (WF6 — không thay bằng thao tác kho thủ công)
    _commit_workstream_inventory(db, ws, tech_id)

    # Update job card
    now_dt = datetime.datetime.utcnow()
    ws.completed_at = now_dt.isoformat() + "Z"
    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc:
            jc.status = "COMPLETED_BY_TECHNICIAN"
            jc.actual_confirmation_status = "COMPLETED"
            jc.completed_at = ws.completed_at
            if jc.requested_delivery_time:
                try:
                    deadline = datetime.datetime.fromisoformat(
                        jc.requested_delivery_time.replace("Z",""))
                    jc.is_on_time = now_dt <= deadline
                    jc.delay_minutes = max(0, int((now_dt - deadline).total_seconds()/60))
                except: jc.is_on_time = True

    # Update parent request
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req:
        _update_request_status_from_workstreams(db, req)

    # Notifications
    team = "PPF" if ws.workstream_type == "PPF_INSTALLATION" else "Window Film"
    _add_notif(db, f"🎉 Đội {team} hoàn tất thi công",
               f"Workstream {ws_id} CLOSED. Tồn kho đã commit. Kiểm tra trạng thái xe.",
               f"{'PPF' if 'PPF' in ws.workstream_type else 'WF'}_TEAM_COMPLETED",
               ws_id, "JOB_CARD", "MANAGER",
               ws_id, ws.workstream_type, ws.team_type)

    if req and req.status == "CLOSED":
        _add_notif(db, "🚗 Xe hoàn tất cả 2 đội!",
                   f"Request {ws.request_id} — Cả PPF và Window Film đã hoàn tất. Xe sẵn sàng bàn giao.",
                   "VEHICLE_FULLY_COMPLETED", ws.request_id, "REQUEST", "ALL")
    elif req and req.status == "PARTIALLY_COMPLETED":
        _add_notif(db, "⏳ Xe hoàn tất một đội",
                   f"Request {ws.request_id} — {ws.workstream_type} CLOSED. Đội còn lại vẫn đang thi công.",
                   "VEHICLE_PARTIALLY_COMPLETED", ws.request_id, "REQUEST", "MANAGER")

    db.commit()
    return {"status":"success",
            "detail":f"✅ {ws.workstream_type} CLOSED. Tồn kho ảo đã commit. Request: {req.status if req else '—'}."}

# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY MANAGER APPROVAL (backward compat — approves ALL workstreams at once)
# ═══════════════════════════════════════════════════════════════════════════════
@app.post("/api/requests/{request_id}/approve")
def approve_request_legacy(request_id: str, db: Session = Depends(get_db)):
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req: raise HTTPException(404, "Not found")
    if req.status not in ("ALLOCATED", "NEEDS_REVIEW"):
        raise HTTPException(400, f"Request must be ALLOCATED or NEEDS_REVIEW. Current: {req.status}")

    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
    jc_ids = []
    if wss:
        for ws in wss:
            if ws.status == "PENDING_APPROVAL":
                result = approve_workstream(ws.workstream_id, {}, db)
                jc_ids.append(result.get("job_card_id",""))
    else:
        # Legacy single workstream (no workstreams table)
        source_type = req.allocated_source_type
        source_id = req.allocated_source_id
        if source_type == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == source_id).first()
            if lot: lot.is_locked = True
        elif source_type == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == source_id).first()
            if oc: oc.is_locked = True
        req.status = "APPROVED"; req.approved_by = "QL-002"
        today = datetime.date.today().strftime("%Y%m%d")
        jc_id = f"JOB-{today}-{request_id[-3:]}"
        if not db.query(DbJobCard).filter(DbJobCard.job_card_id == jc_id).first():
            db.add(DbJobCard(
                job_card_id=jc_id, request_id=request_id,
                technician_id="KTV-003", technician_name="Nguyễn Văn An",
                vehicle_model_code=req.vehicle_model_code, material_code=req.material_code,
                job_items=req.job_items,
                planned_cut_block=req.planned_cut_block,
                planned_deduction_length_m=req.planned_deduction_length_m,
                allocated_source_id=source_id, status="PENDING",
                requested_delivery_time=(
                    datetime.datetime.utcnow() + datetime.timedelta(hours=4)).isoformat() + "Z",
                created_at=_now()
            ))
            jc_ids.append(jc_id)
        _audit(db, request_id, "SOFT_LOCK_RECORDED", source_type, source_id,
               "is_locked=false", "is_locked=true",
               "QL-002 phê duyệt, kích hoạt Soft Lock.", "QL-002")

    _update_request_status_from_workstreams(db, req)
    db.commit()
    return {"status":"success",
            "detail":f"✅ Phê duyệt thành công. Job Cards: {', '.join(jc_ids) or 'N/A'}.",
            "job_card_ids": jc_ids}

# ═══════════════════════════════════════════════════════════════════════════════
# LEGACY TECH COMPLETE (WF6 — uses workstream if exists)
# ═══════════════════════════════════════════════════════════════════════════════
@app.post("/api/requests/{request_id}/complete")
def complete_request_legacy(request_id: str, data: dict, db: Session = Depends(get_db)):
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req: raise HTTPException(404, "Not found")
    if req.status not in ("APPROVED","IN_PROGRESS"):
        raise HTTPException(400, f"Request must be APPROVED. Current: {req.status}")

    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
    if wss:
        # Route to Window Film workstream by default
        wf = next((w for w in wss if w.workstream_type == "WINDOW_FILM_INSTALLATION"), wss[0])
        if wf.actual_confirmation_status != "COMPLETED":
            # Auto-fill actual from data
            actual_data = {
                "actual_cut_block": data.get("actual_cut_block", wf.planned_cut_block),
                "actual_width_m": 1.52,
                "actual_length_m": float(data.get("actual_length_m", wf.planned_deduction_length_m or 1.43)),
                "has_new_offcut": float(data.get("created_offcut_length_m", 0)) > 0,
                "offcut_width_m": float(data.get("created_offcut_width_m", 0)),
                "offcut_length_m": float(data.get("created_offcut_length_m", 0)),
                "offcut_quality_status": data.get("created_offcut_quality", "NORMAL"),
                "offcut_storage_location": data.get("created_offcut_location", "OFFCUT-RACK-C"),
                "has_scrap": float(data.get("scrap_area_m2", 0)) > 0,
                "scrap_area_m2": float(data.get("scrap_area_m2", 0)),
            }
            submit_actual(wf.workstream_id, actual_data, db)
        result = complete_workstream(wf.workstream_id, data, db)
        return result

    # Truly legacy (no workstreams)
    actual_length = float(data.get("actual_length_m", req.planned_deduction_length_m or 1.43))
    actual_block = data.get("actual_cut_block", req.planned_cut_block)
    exception_reason = data.get("exception_reason","")
    tech_id = data.get("technician_id","KTV-003")
    if actual_block != req.planned_cut_block and not exception_reason:
        req.status = "EXCEPTION_HOLD"
        req.exception_reason = "Block thực tế khác kế hoạch nhưng chưa nhập lý do."
        db.commit()
        return {"status":"exception_hold","detail":"Cần nhập lý do ngoại lệ."}
    source_type = req.allocated_source_type
    source_id = req.allocated_source_id
    before_bal = after_bal = 0.0
    if source_type == "LOT":
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == source_id).first()
        if lot:
            before_bal = lot.remaining_length_m
            lot.remaining_length_m = round(lot.remaining_length_m - actual_length, 3)
            after_bal = lot.remaining_length_m
            lot.is_locked = False; lot.is_opened = True
    offcut_len = float(data.get("created_offcut_length_m", 0))
    offcut_wid = float(data.get("created_offcut_width_m", 0))
    new_offcut_id = None
    if offcut_len > 0 and offcut_wid > 0:
        base = f"SUBLOT-{req.material_code}"
        cnt = db.query(DbOffcutInventory).filter(
            DbOffcutInventory.offcut_id.like(f"{base}-%")).count()
        new_offcut_id = f"{base}-{str(cnt+1).zfill(3)}"
        pl, po = _parent_links_for_ws_offcut(db, source_type or "LOT", source_id or "")
        create_offcut_from_workstream_return(
            db,
            offcut_id=new_offcut_id,
            material_code=(req.material_code or "JB20").strip(),
            width_m=float(offcut_wid),
            length_m=float(offcut_len),
            quality_status=data.get("created_offcut_quality", "NORMAL"),
            storage_location=data.get("created_offcut_location", "OFFCUT-RACK-C"),
            request_id=request_id,
            workstream_id=f"LEGACY-{request_id}",
            job_card_id=None,
            performed_by=tech_id,
            note=data.get("technician_note"),
            parent_lot_id=pl,
            parent_offcut_id=po,
            film_type="WINDOW_FILM",
        )
    scrap = float(data.get("scrap_area_m2", 0))
    req.status = "CLOSED"; req.actual_cut_block = actual_block
    req.actual_length_m = actual_length; req.scrap_area_m2 = scrap
    req.created_offcut_id = new_offcut_id; req.technician_id = tech_id
    _audit(db, request_id, f"ISSUE_FROM_{source_type}", source_type, source_id,
           f"{before_bal}m", f"{after_bal}m",
           f"KTV {tech_id} hoàn tất thi công.", tech_id)
    if new_offcut_id: _audit(db, request_id, "CREATE_OFFCUT", source_type, source_id,
                              "None", new_offcut_id, "Mảnh dư mới.", tech_id)
    if scrap > 0: _audit(db, request_id, "RECORD_SCRAP", source_type, source_id,
                          "None", f"Scrap {scrap}m²", "Phế liệu.", tech_id)
    _audit(db, request_id, "RELEASE_LOCK", source_type, source_id,
           "is_locked=true", "is_locked=false", "Giải phóng Soft Lock.", "SYSTEM")
    db.commit()
    return {"status":"success","detail":"✅ WF6 — Hoàn tất! Kho đã trừ, Soft Lock giải phóng."}

# ═══════════════════════════════════════════════════════════════════════════════
# JOB CARDS
# ═══════════════════════════════════════════════════════════════════════════════
def _job_completion_photos_list(jc: DbJobCard) -> list:
    raw = getattr(jc, "completion_photos_json", None) or ""
    if not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:
        return []


@app.get("/api/job-cards")
def get_job_cards(db: Session = Depends(get_db)):
    return db.query(DbJobCard).order_by(DbJobCard.created_at.desc()).all()


@app.post("/api/job-cards/{jc_id}/completion-photos")
async def upload_job_completion_photo(jc_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """KTV tải ảnh chứng minh hoàn thành thi công (chụp / chọn file)."""
    jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == jc_id).first()
    if not jc:
        raise HTTPException(404, "Job card not found")
    if jc.status not in ("IN_PROGRESS", "ACTUAL_CONFIRMATION_REQUIRED"):
        raise HTTPException(
            400,
            "Chỉ tải ảnh khi lệnh đang thi công (IN_PROGRESS) hoặc chờ xác nhận thực tế (ACTUAL_CONFIRMATION_REQUIRED).",
        )
    max_photos = 12
    max_bytes = 8 * 1024 * 1024
    urls = _job_completion_photos_list(jc)
    if len(urls) >= max_photos:
        raise HTTPException(400, f"Tối đa {max_photos} ảnh hoàn thành.")

    filename = file.filename or "completion.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"):
        ext = ".jpg"
    file_id = f"COMP-{_uid()}"
    save_filename = f"{file_id}{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, save_filename)

    size = 0
    md5_hash = hashlib.md5()
    with open(save_path, "wb") as buffer:
        while chunk := await file.read(8192):
            size += len(chunk)
            if size > max_bytes:
                try:
                    os.remove(save_path)
                except OSError:
                    pass
                raise HTTPException(400, "File quá lớn (tối đa 8 MB).")
            buffer.write(chunk)
            md5_hash.update(chunk)

    image_url = f"/static/uploads/{save_filename}"
    urls.append(image_url)
    jc.completion_photos_json = json.dumps(urls, ensure_ascii=False)
    db.commit()
    return {
        "status": "success",
        "detail": "Đã lưu ảnh hoàn thành.",
        "url": image_url,
        "photos": urls,
        "md5": md5_hash.hexdigest(),
    }

@app.post("/api/job-cards/{jc_id}/start")
def start_job(jc_id: str, db: Session = Depends(get_db)):
    jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == jc_id).first()
    if not jc: raise HTTPException(404, "Job card not found")
    if jc.status != "PENDING": raise HTTPException(400, f"Must be PENDING. Current: {jc.status}")
    jc.status = "IN_PROGRESS"; jc.started_at = _now()
    # Mirror to workstream
    if jc.workstream_id:
        ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == jc.workstream_id).first()
        if ws and ws.status == "APPROVED":
            ws.status = "IN_PROGRESS"; ws.started_at = jc.started_at
    req = db.query(DbRequest).filter(DbRequest.request_id == jc.request_id).first()
    if req: _update_request_status_from_workstreams(db, req)
    _add_notif(db, f"🔧 KTV bắt đầu thi công",
               f"Job {jc_id} ({jc.workstream_type or 'STANDARD'}) — {jc.technician_name} bắt đầu.",
               "JOB_STARTED", jc_id, "JOB_CARD", "MANAGER",
               jc.workstream_id, jc.workstream_type)
    db.commit()
    return {"status":"success","detail":f"✅ Bắt đầu lúc {jc.started_at[:16]}Z."}

@app.post("/api/job-cards/{jc_id}/request-complete")
def request_complete_job(jc_id: str, data: dict = None, db: Session = Depends(get_db)):
    jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == jc_id).first()
    if not jc: raise HTTPException(404, "Job card not found")
    if jc.status != "IN_PROGRESS": raise HTTPException(400, "Must be IN_PROGRESS.")
    if jc.actual_confirmation_status != "COMPLETED":
        jc.status = "ACTUAL_CONFIRMATION_REQUIRED"
        if jc.workstream_id:
            ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == jc.workstream_id).first()
            if ws: ws.status = "ACTUAL_CONFIRMATION_REQUIRED"
        db.commit()
        return {"status":"info","detail":"⚠️ Cần nhập xác nhận kích thước thực tế trước."}
    if len(_job_completion_photos_list(jc)) < 1:
        jc.status = "ACTUAL_CONFIRMATION_REQUIRED"
        if jc.workstream_id:
            ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == jc.workstream_id).first()
            if ws:
                ws.status = "ACTUAL_CONFIRMATION_REQUIRED"
        db.commit()
        return {
            "status": "info",
            "detail": "⚠️ Cần ít nhất 1 ảnh hoàn thành (nút «Hình ảnh hoàn thành» trên lệnh thi công) trước khi hoàn tất lệnh.",
        }
    jc.status = "COMPLETED_BY_TECHNICIAN"; jc.completed_at = _now()
    db.commit()
    return {"status":"success","detail":"✅ Hoàn tất Job Card."}

# ═══════════════════════════════════════════════════════════════════════════════
# OCR INTAKE
# ═══════════════════════════════════════════════════════════════════════════════
def _serialize_ocr_draft_row(r: DbOcrDraft) -> dict:
    """Trả về dict JSON-safe; merge extra_payload_json để UI đọc request_no, contract_no, ..."""
    out = {}
    for c in r.__table__.columns:
        out[c.name] = getattr(r, c.name)
    ep = getattr(r, "extra_payload_json", None) or None
    if ep:
        try:
            extra = json.loads(ep)
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if k not in out or out.get(k) in (None, ""):
                        out[k] = v
        except Exception:
            pass
            
    services = out.get("extracted_services") or r.extracted_services or ""
    film_type = out.get("extracted_film_type") or r.extracted_film_type or ""
    item_desc = out.get("item_description") or ""
    
    is_konica = "konica" in film_type.lower() or "konica" in item_desc.lower() or "konica" in (r.extracted_film_type or "").lower()
    
    if "PPF" in services and ("WINDOW_FILM" in services or "WINDOW" in services) and is_konica:
        out["extracted_film_type"] = "PPF + Phim cách nhiệt Konica"
    elif film_type == "Phim cách nhiệt JB20 + PPF T-TYPE":
        out["extracted_film_type"] = "PPF + Phim cách nhiệt"
        
    return out


def _next_ocr_tracking_counters(db: Session) -> dict:
    """Gợi ý STT năm / STT tháng dựa trên các đơn (requests) đã tạo."""
    utc = datetime.datetime.utcnow()
    y = utc.year
    ym_prefix = f"{y}-{utc.month:02d}"
    max_y = 0
    max_m = 0
    for row in db.query(DbRequest).all():
        cat = getattr(row, "created_at", None) or ""
        cat_s = str(cat)
        if len(cat_s) < 4 or not cat_s.startswith(str(y)):
            continue
        sn = getattr(row, "sequence_no", None)
        if sn is not None and str(sn).strip().isdigit():
            max_y = max(max_y, int(str(sn).strip()))
        if len(cat_s) >= 7 and cat_s[:7] == ym_prefix:
            snm = getattr(row, "sequence_no_month", None)
            if snm is not None and str(snm).strip().isdigit():
                max_m = max(max_m, int(str(snm).strip()))
    return {"sequence_year_next": max_y + 1, "sequence_month_next": max_m + 1}


@app.get("/api/ocr/tracking-counters")
def get_ocr_tracking_counters(db: Session = Depends(get_db)):
    """STT theo dõi xe thi công: năm (từ 1/1) và tháng hiện tại (từ đầu tháng)."""
    return _next_ocr_tracking_counters(db)


@app.get("/api/ocr-drafts")
def get_ocr_drafts(db: Session = Depends(get_db)):
    rows = db.query(DbOcrDraft).order_by(DbOcrDraft.created_at.desc()).all()
    return [_serialize_ocr_draft_row(x) for x in rows]


@app.post("/api/test-data/lexus-ocr-drafts")
def post_lexus_test_ocr_drafts(db: Session = Depends(get_db)):
    """Seed / cập nhật 2 OCR draft Lexus test (demo)."""
    return upsert_lexus_ocr_drafts(db)

import shutil

@app.post("/api/ocr/upload")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_id = f"IMG-{_uid()}"
    draft_id = f"OCR-{_uid()}"
    
    # Extract extension
    filename = file.filename or "uploaded_image.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if not ext:
        ext = ".jpg"
        
    save_filename = f"{file_id}{ext}"
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, save_filename)
    
    # Save file and calculate hash
    md5_hash = hashlib.md5()
    with open(save_path, "wb") as buffer:
        while chunk := await file.read(8192):
            buffer.write(chunk)
            md5_hash.update(chunk)
            
    source_image_hash = md5_hash.hexdigest()
    image_url = f"/static/uploads/{save_filename}"
    
    draft = DbOcrDraft(
        ocr_draft_id=draft_id, 
        image_file_id=file_id,
        image_filename=filename, 
        image_url=image_url,
        ocr_status="PENDING", 
        review_status="PENDING", 
        created_at=_now(),
        extra_payload_json=json.dumps({
            "source_image_hash": source_image_hash,
            "source_file_id": file_id
        }, ensure_ascii=False)
    )
    db.add(draft)
    _add_notif(db, "📷 Ảnh phiếu upload", f"File '{filename}' upload xong. Chờ OCR.",
               "INFO", draft_id, "REQUEST", "ADMIN")
    db.commit()
    return {"status":"success","ocr_draft_id":draft_id,"detail":f"Upload OK. Draft {draft_id} tạo."}
@app.post("/api/ocr/debug-raw-text")
def debug_raw_text(data: dict, db: Session = Depends(get_db)):
    draft_id = data.get("ocr_draft_id")
    if not draft_id:
        raise HTTPException(400, "Missing ocr_draft_id")
        
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")
        
    ep = draft.extra_payload_json or "{}"
    try:
        extra = json.loads(ep)
    except:
        extra = {}
        
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
    filename_on_disk = os.path.basename(draft.image_url) if draft.image_url else ""
    source_file_path = os.path.join(upload_dir, filename_on_disk)
    
    return {
        "ocr_draft_id": draft_id,
        "source_file_path": source_file_path,
        "file_exists": extra.get("file_exists", os.path.exists(source_file_path)),
        "image_width": extra.get("image_width", 0),
        "image_height": extra.get("image_height", 0),
        "raw_text_length": len(extra.get("raw_text", "")),
        "raw_text": extra.get("raw_text", ""),
        "ocr_engine": "MOCK (pytesseract/easyocr not installed)",
        "error": None if extra.get("raw_text") else "No text extracted or unsupported OCR engine."
    }

@app.post("/api/ocr/{draft_id}/process")
def process_ocr(draft_id: str, db: Session = Depends(get_db)):
    if is_lexus_test_draft_id(draft_id):
        return {"status": "info", "detail": "Phiếu test Lexus — đã có dữ liệu OCR đầy đủ, không chạy lại mock."}
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft: raise HTTPException(404, "OCR Draft not found")
    if draft.ocr_status == "COMPLETED":
        return {"status":"info","detail":"OCR đã hoàn thành."}
    
    draft.ocr_status = "PROCESSING"
    db.commit()
    
    # 1. KIỂM TRA UPLOAD FILE VÀ LOG
    ep = draft.extra_payload_json or "{}"
    try:
        extra = json.loads(ep)
    except:
        extra = {}
        
    source_file_id = extra.get("source_file_id", "UNKNOWN")
    source_image_hash = extra.get("source_image_hash", "UNKNOWN")
    
    # Get physical file
    upload_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
    # Resolve the exact filename from image_url
    filename_on_disk = os.path.basename(draft.image_url) if draft.image_url else ""
    source_file_path = os.path.join(upload_dir, filename_on_disk)
    
    file_exists = os.path.exists(source_file_path)
    file_size = os.path.getsize(source_file_path) if file_exists else 0
    img_width, img_height = 0, 0
    mime_type = "UNKNOWN"
    
    if file_exists:
        try:
            import PIL.Image
            import mimetypes
            with PIL.Image.open(source_file_path) as img:
                img_width, img_height = img.size
            mime_type = mimetypes.guess_type(source_file_path)[0] or "UNKNOWN"
        except Exception as e:
            print(f"Error reading image details: {e}")
            
    print("\n" + "="*50)
    print("[UPLOAD FILE CHECK]")
    print(f"source_file_id:    {source_file_id}")
    try:
        print(f"source_file_path:  {source_file_path}".encode("utf-8", "replace").decode("utf-8"))
    except:
        pass
    print(f"source_file_url:   {draft.image_url}")
    print(f"source_image_hash: {source_image_hash}")
    print(f"file_exists:       {file_exists}")
    print(f"file_size:         {file_size} bytes")
    print(f"image_width:       {img_width}")
    print(f"image_height:      {img_height}")
    print(f"mime_type:         {mime_type}")
    print("="*50)
    
    # 2. KIỂM TRA OCR ENGINE VÀ LOG RAW TEXT
    raw_text = extra.get("raw_text", "")
    
    # MOCK DATA FOR DEMO IF NO OCR ENGINE AVAILABLE
    if not raw_text:
        raw_text = """
Tên đại lý: LEXUS TRUNG TÂM SÀI GÒN
Địa chỉ đơn vị: 264 Trần Hưng Đạo, phường Cầu Ông Lãnh, TP Hồ Chí Minh
Điện thoại: (+84) 28 38 377 377
Fax: (+84) 28 38 377 177
Số đề nghị: 01.2600104
Ngày yêu cầu: 20/04/2026
Tên khách hàng: LÊ THANH PHƯƠNG
Địa chỉ khách hàng: Ô 1B, DC 19, Khu phố 4, Phường An Phú, Thành phố Hồ Chí Minh
Số điện thoại khách hàng: 0901234567
Tư vấn bán hàng: NGUYỄN QUANG BẢO
Số HĐ: 0844/HDKT/2025/LX600
Loại xe: LX600 URBAN
Số khung: JTJPB7CX304095170
Thời gian giao xe: 27/04/2026
        """
    
    # regex extractors
    import re
    def get_match(pattern, text, default=""):
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else default

    draft.extracted_dealer_name = get_match(r"(?:Đơn vị|Tên đại lý|Đại lý)[:\-]\s*(.*)", raw_text)
    draft.extracted_dealer_address = get_match(r"(?:Địa chỉ đơn vị)[:\-]\s*(.*)", raw_text)
    draft.extracted_dealer_phone = get_match(r"(?:Điện thoại|SĐT đơn vị)[:\-]\s*(.*)", raw_text)
    draft.extracted_dealer_fax = get_match(r"(?:Fax)[:\-]\s*(.*)", raw_text)
    draft.extracted_request_no = get_match(r"(?:Số đề nghị|Số yêu cầu)[:\-]\s*(.*)", raw_text)
    draft.extracted_request_date = get_match(r"(?:Ngày yêu cầu)[:\-]\s*(.*)", raw_text)
    draft.extracted_contract_no = get_match(r"(?:Số hợp đồng|Số HĐ)[:\-]\s*(.*)", raw_text)
    
    draft.extracted_customer_name = get_match(r"(?:Tên khách hàng|Khách hàng)[:\-]\s*(.*)", raw_text)
    draft.extracted_customer_address = get_match(r"(?:Địa chỉ khách hàng|Địa chỉ)[:\-]\s*(.*)", raw_text)
    draft.extracted_customer_phone = get_match(r"(?:Số điện thoại khách hàng|Điện thoại khách hàng|SĐT)[:\-]\s*(.*)", raw_text)
    
    draft.extracted_vehicle_model = get_match(r"(?:Loại xe|Model)[:\-]\s*(.*)", raw_text)
    draft.extracted_vin = get_match(r"(?:Số khung|Frame No)[:\-]\s*(.*)", raw_text)
    draft.extracted_delivery_time = get_match(r"(?:Ngày giao xe|Thời gian giao xe)[:\-]\s*(.*)", raw_text)
    draft.sales_consultant = get_match(r"(?:Tư vấn bán hàng|TVBH)[:\-]\s*(.*)", raw_text)

    # Clean VIN
    if draft.extracted_vin:
        draft.extracted_vin = re.sub(r'[^A-Z0-9]', '', draft.extracted_vin.upper())

    # Entity Resolution (Dealer)
    draft.dealer_resolution_status = "NOT_FOUND"
    if draft.extracted_dealer_name:
        from database import DbDealer
        dealer = db.query(DbDealer).filter(DbDealer.dealer_name.ilike(f"%{draft.extracted_dealer_name}%")).first()
        if dealer:
            draft.extracted_dealer_name = dealer.dealer_name
            draft.resolved_dealer_id = dealer.dealer_id
            draft.dealer_resolution_status = "MATCHED"
            draft.confidence_dealer = 1.0
        else:
            draft.dealer_resolution_status = "REVIEW_REQUIRED"
            draft.confidence_dealer = 0.85

    # Entity Resolution (Customer)
    draft.customer_resolution_status = "NOT_FOUND"
    if draft.extracted_customer_name:
        from database import DbCustomer
        customer = db.query(DbCustomer).filter(DbCustomer.customer_name.ilike(f"%{draft.extracted_customer_name}%")).first()
        if customer:
            draft.extracted_customer_name = customer.customer_name
            draft.resolved_customer_id = customer.customer_id
            draft.customer_resolution_status = "MATCHED"
            draft.confidence_customer = 1.0
        else:
            draft.customer_resolution_status = "REVIEW_REQUIRED"
            draft.confidence_customer = 0.85

    draft.confidence_vehicle = 0.85 if draft.extracted_vin else 0.0
    draft.confidence_overall = 0.85 if draft.extracted_vin else 0.0

    extra["address"] = draft.extracted_customer_address
    extra["request_date"] = draft.extracted_request_date
    if not extra.get("extracted_services"):
        extra["extracted_services"] = "PPF, WINDOW_FILM"
        extra["extracted_film_type"] = "Phim cách nhiệt Konica"
        extra["extracted_ppf_type"] = "PPF"
    draft.extra_payload_json = json.dumps(extra, ensure_ascii=False)

    detail_msg = "✅ OCR xử lý thành công. Cần Review."
    draft.ocr_status = "COMPLETED"
    draft.review_status = "REVIEWING"
    _add_notif(db, "🤖 OCR hoàn tất", f"Draft {draft_id} — {detail_msg}",
               "INFO", draft_id, "REQUEST", "ADMIN")
    db.commit()
    return {"status":"success","draft":draft,"detail":detail_msg}

@app.post("/api/ocr/{draft_id}/confirm")
def confirm_ocr(draft_id: str, data: dict, db: Session = Depends(get_db)):
    if is_lexus_test_draft_id(draft_id):
        return confirm_lexus_test_ocr(db, draft_id, data or {}, actor="ADMIN-001")
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft: raise HTTPException(404, "Not found")
    if draft.review_status in ("CONFIRMED","CANCELLED"):
        raise HTTPException(400, "Draft đã xử lý.")

    # 10. Validate Mandatory fields
    required = ["dealer_name", "customer_name", "vehicle_model", "vin", "requested_delivery_time"]
    for req in required:
        val = data.get(req)
        if not val or val == "UNKNOWN" or val == "Chưa đọc được - Cần rà soát":
            raise HTTPException(400, f"Thiếu thông tin bắt buộc: {req}")

    # Dynamic Request ID generation: DYC-YYMMDD-{6 cuối số khung}
    vin_val = data.get("vin").strip().upper()
    vin_val = re.sub(r'[^A-Z0-9]', '', vin_val)
    if len(vin_val) < 6:
        raise HTTPException(400, "VIN phải có ít nhất 6 ký tự.")
    vin_last_6 = vin_val[-6:]
    yymmdd = datetime.datetime.now().strftime("%y%m%d")
    base_req_id = f"DYC-{yymmdd}-{vin_last_6}"
    
    new_req_id = base_req_id
    existing_req = db.query(DbRequest).filter(DbRequest.request_id == new_req_id).first()
    if existing_req:
        new_req_id = f"{base_req_id}-{_uid()[:4]}"

    # Auto Create Dealer
    dealer_name = data.get("dealer_name").strip()
    dealer = db.query(DbDealer).filter(DbDealer.dealer_name.ilike(f"%{dealer_name}%")).first()
    if dealer:
        dealer_id = dealer.dealer_id
        dealer_name_disp = dealer.dealer_name
        _add_audit_log(db, "DEALER_MATCHED_FROM_MASTER", draft_id, new_req_id, "", dealer_id)
    else:
        dealer_id = f"DLR-{_uid()}"
        dealer_name_disp = dealer_name
        dlr_addr = (data.get("dealer_address") or "").strip()
        new_dlr = DbDealer(
            dealer_id=dealer_id,
            dealer_name=dealer_name,
            address=dlr_addr or None,
            full_address=dlr_addr or None,
            created_at=_now(),
        )
        db.add(new_dlr)
        _add_audit_log(db, "DEALER_AUTO_CREATED_FROM_OCR_ON_CONFIRM", draft_id, new_req_id, "", dealer_id)

    # Auto Create Customer
    customer_name = data.get("customer_name").strip()
    c_phone = (data.get("customer_phone") or "").strip()
    c_address = (data.get("customer_address") or "").strip()
    
    q_cust = db.query(DbCustomer).filter(DbCustomer.customer_name.ilike(f"%{customer_name}%"))
    if c_phone:
        q_cust = q_cust.filter(DbCustomer.phone.ilike(f"%{c_phone}%"))
    if c_address:
        q_cust = q_cust.filter(DbCustomer.full_address.ilike(f"%{c_address}%"))
    
    customer = q_cust.first()
    if customer:
        customer_id = customer.customer_id
        cust_display = customer.customer_name
        _add_audit_log(db, "CUSTOMER_MATCHED_FROM_MASTER", draft_id, new_req_id, "", customer_id)
    else:
        customer_id = f"KHL-{_uid()}"
        cust_display = customer_name
        new_cust = DbCustomer(
            customer_id=customer_id, 
            customer_name=customer_name, 
            phone=data.get("customer_phone"),
            full_address=data.get("customer_address"),
            created_at=_now()
        )
        db.add(new_cust)
        _add_audit_log(db, "CUSTOMER_AUTO_CREATED_FROM_OCR_ON_CONFIRM", draft_id, new_req_id, "", customer_id)

    # Auto Create Vehicle
    vehicle = db.query(DbVehicleProfile).filter(DbVehicleProfile.vin_number == vin_val).first()
    if vehicle:
        vehicle_id = vehicle.vehicle_id
        _add_audit_log(db, "VEHICLE_MATCHED_FROM_MASTER", draft_id, new_req_id, "", vehicle_id)
    else:
        vehicle_id = f"VEH-{_uid()}"
        new_veh = DbVehicleProfile(
            vehicle_id=vehicle_id, 
            vin_number=vin_val, 
            vin_masked=vin_val, 
            vehicle_model_code=data.get("vehicle_model"),
            model_name=data.get("vehicle_model"), 
            model_year=int(data.get("model_year")) if data.get("model_year") else None,
            customer_id=customer_id,
            dealer_id=dealer_id,
            created_from_request_id=new_req_id,
            created_at=_now()
        )
        db.add(new_veh)
        _add_audit_log(db, "VEHICLE_AUTO_CREATED_FROM_OCR_ON_CONFIRM", draft_id, new_req_id, "", vehicle_id)

    services_str = (data.get("services") or "WINDOW_FILM").strip()
    has_ppf = "PPF" in services_str.upper()
    has_wf = "PCN" in services_str.upper() or "WINDOW" in services_str.upper() or "FILM" in services_str.upper()
    is_multi = has_ppf and has_wf

    contract_no_val = (data.get("contract_no") or "").strip()
    if not contract_no_val:
        contract_no_val = (getattr(draft, "extracted_contract_no", None) or "").strip() or None

    sn_val = str(data.get("sequence_no") or "").strip() or None
    snm_val = str(data.get("sequence_no_month") or "").strip() or None

    service_json = {"services": services_str}
    for k in ["model_year", "service_1", "film_type_1", "service_2", "film_type_2"]:
        if data.get(k):
            service_json[k] = data.get(k)
    if sn_val is not None:
        service_json["sequence_no"] = sn_val
    if snm_val is not None:
        service_json["sequence_no_month"] = snm_val

    new_req = DbRequest(
        request_id=new_req_id,
        dealer_id=dealer_id,
        dealer_name=dealer_name_disp,
        customer_id=customer_id,
        customer_name=cust_display,
        vehicle_id=vehicle_id,
        vin_number=vin_val,
        vehicle_model_code=data.get("vehicle_model"),
        material_code="JB20", 
        job_items=data.get("job_items") or "",
        status="DRAFT", is_grouped_cut=False, is_multi_workstream=is_multi,
        requested_delivery_time=data.get("requested_delivery_time"),
        created_at=_now(),
        source_channel="OCR",
        request_no=data.get("request_no"),
        contract_no=contract_no_val,
        request_date=data.get("request_date"),
        sequence_no=sn_val,
        sequence_no_month=snm_val,
        model_name=data.get("vehicle_model"),
        sales_consultant=data.get("sales_consultant"),
        ocr_source_image=draft.image_filename,
        service_selection_json=json.dumps(service_json, ensure_ascii=False)
    )
    db.add(new_req)
    draft.review_status = "CONFIRMED"; draft.confirmed_by = "ADMIN"
    draft.confirmed_at = _now(); draft.created_request_id = new_req_id
    if sn_val is not None:
        draft.sequence_no = sn_val
    try:
        _ex = {}
        if getattr(draft, "extra_payload_json", None):
            try:
                _ex = json.loads(draft.extra_payload_json) or {}
            except Exception:
                _ex = {}
        if sn_val is not None:
            _ex["sequence_no"] = sn_val
        if snm_val is not None:
            _ex["sequence_no_month"] = snm_val
        draft.extra_payload_json = json.dumps(_ex, ensure_ascii=False) if _ex else None
    except Exception:
        pass
    
    _add_audit_log(db, "OCR_DRAFT_CONFIRMED", draft_id, new_req_id, "", "")
    _add_audit_log(db, "REQUEST_CREATED_FROM_IMAGE", draft_id, new_req_id, "", "")
    
    _add_notif(db, "📋 Request tạo từ OCR", f"OCR {draft_id} → Request {new_req_id}", "INFO", new_req_id, "REQUEST", "ADMIN")
    db.commit()
    return {"status":"success","request_id":new_req_id, "detail":f"✅ Request {new_req_id} tạo thành công."}

@app.post("/api/ocr/{draft_id}/cancel")
def cancel_ocr(draft_id: str, db: Session = Depends(get_db)):
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Không tìm thấy phiếu OCR")
    st = (draft.review_status or "").upper()
    if st == "CONFIRMED":
        raise HTTPException(
            400,
            "Phiếu đã tạo đơn — không thể « hủy phiếu ». Dùng API rollback / nút « Hủy xác nhận » để gỡ đơn và chỉnh lại phiếu.",
        )
    if st == "CANCELLED":
        return {"status": "success", "detail": "Phiếu OCR đã ở trạng thái đã hủy."}
    draft.review_status = "CANCELLED"
    db.commit()
    return {"status": "success", "detail": "Đã đánh dấu phiếu OCR là đã hủy (chưa tạo đơn thi công)."}

@app.post("/api/ocr/{draft_id}/rollback")
def rollback_ocr_confirmation(draft_id: str, db: Session = Depends(get_db)):
    draft = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == draft_id).first()
    if not draft:
        raise HTTPException(404, "Draft not found")
    if draft.review_status != "CONFIRMED":
        raise HTTPException(400, "Draft chưa được CONFIRMED.")
    
    req_id = draft.created_request_id
    if not req_id:
        raise HTTPException(400, "Không tìm thấy request_id liên quan trên draft.")
        
    # Delete job cards, workstreams, request, notifications, and audit logs
    db.query(DbJobCard).filter(DbJobCard.request_id == req_id).delete()
    db.query(DbWorkstream).filter(DbWorkstream.request_id == req_id).delete()
    db.query(DbNotification).filter(DbNotification.related_id == req_id).delete()
    
    # Release any soft locks on lots or offcuts for these workstreams
    db.query(DbLotInventory).filter(DbLotInventory.locked_by_request_id == req_id).update({
        DbLotInventory.is_locked: False,
        DbLotInventory.locked_by_request_id: None,
        DbLotInventory.locked_by_workstream_id: None
    })
    db.query(DbOffcutInventory).filter(DbOffcutInventory.locked_by_request_id == req_id).update({
        DbOffcutInventory.is_locked: False,
        DbOffcutInventory.locked_by_request_id: None,
        DbOffcutInventory.locked_by_workstream_id: None
    })
    
    # Delete vehicle profiles and customer records created from this request
    db.query(DbVehicleProfile).filter(DbVehicleProfile.created_from_request_id == req_id).delete()
    db.query(DbCustomer).filter(DbCustomer.created_from_request_id == req_id).delete()
    
    # Delete request itself
    db.query(DbRequest).filter(DbRequest.request_id == req_id).delete()
    
    # Delete audit logs related to this request
    db.query(DbAuditLog).filter(DbAuditLog.request_id == req_id).delete()
    
    # Reset draft review status
    draft.review_status = "NEEDS_REVIEW"
    draft.confirmed_by = None
    draft.confirmed_at = None
    draft.created_request_id = None
    
    db.commit()
    return {
        "status": "success",
        "detail": f"Đã hủy xác nhận (rollback) thành công đơn hàng {req_id}."
    }

# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════
@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(DbNotification).order_by(DbNotification.created_at.desc()).limit(60).all()

@app.post("/api/notifications/{nid}/read")
def mark_read(nid: str, db: Session = Depends(get_db)):
    n = db.query(DbNotification).filter(DbNotification.notif_id == nid).first()
    if n: n.is_read = True; db.commit()
    return {"status":"ok"}

@app.post("/api/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(DbNotification).update({"is_read": True}); db.commit()
    return {"status":"ok"}

# ═══════════════════════════════════════════════════════════════════════════════
# DEMO RUN ALL — Multi-Workstream E2E
# ═══════════════════════════════════════════════════════════════════════════════
@app.post("/api/demo/run-all/{request_id}")
def demo_run_all(request_id: str, db: Session = Depends(get_db)):
    req = db.query(DbRequest).filter(DbRequest.request_id == request_id).first()
    if not req: raise HTTPException(404, "Not found")
    steps = []
    max_iter = 20

    def _step():
        db.refresh(req)
        if req.status == "DRAFT":
            r = run_request_step(request_id, db); db.refresh(req)
            steps.append({"step":"WF2_STANDARDIZE","result":r.get("detail","")})
        elif req.status == "STANDARDIZED":
            r = run_request_step(request_id, db); db.refresh(req)
            steps.append({"step":"WF3_NORM","result":r.get("detail","")})
        elif req.status == "NORM_ASSIGNED":
            r = run_request_step(request_id, db); db.refresh(req)
            steps.append({"step":"WF4_ALLOCATE","result":r.get("detail","")})
        elif req.status in ("ALLOCATED", "NEEDS_REVIEW"):
            r = approve_request_legacy(request_id, db); db.refresh(req)
            steps.append({"step":"WF5_APPROVE_ALL","result":r.get("detail","")})
        elif req.status in ("APPROVED","IN_PROGRESS","PARTIALLY_COMPLETED"):
            # Complete all pending workstreams
            wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == request_id).all()
            if wss:
                for ws in wss:
                    if ws.status in ("APPROVED","IN_PROGRESS","ACTUAL_CONFIRMATION_REQUIRED"):
                        if ws.status == "APPROVED":
                            start_workstream(ws.workstream_id, db); db.refresh(ws)
                            steps.append({"step":f"START_{ws.workstream_type[:3]}",
                                          "result":f"Started {ws.workstream_type}"})
                        # Submit actual
                        actual_len = ws.planned_deduction_length_m or 1.43
                        actual_wid = 13.0 if "PPF" in ws.workstream_type else 1.52
                        submit_actual(ws.workstream_id, {
                            "actual_cut_block": ws.planned_cut_block,
                            "actual_width_m": actual_wid,
                            "actual_length_m": actual_len,
                            "has_new_offcut": True,
                            "offcut_width_m": actual_wid,
                            "offcut_length_m": round(actual_len * 0.08, 2),
                            "offcut_quality_status": "NORMAL",
                            "offcut_storage_location": "OFFCUT-RACK-C",
                            "has_scrap": True,
                            "scrap_area_m2": 0.35,
                        }, db)
                        r = complete_workstream(ws.workstream_id, {}, db); db.refresh(ws)
                        steps.append({"step":f"COMPLETE_{ws.workstream_type[:3]}",
                                      "result":r.get("detail","")})
                db.refresh(req)
            else:
                # No workstreams — legacy complete
                payload = {
                    "actual_cut_block": req.planned_cut_block,
                    "actual_length_m": req.planned_deduction_length_m,
                    "created_offcut_length_m": 1.2,
                    "created_offcut_width_m": 1.52,
                    "created_offcut_quality": "NORMAL",
                    "created_offcut_location": "OFFCUT-RACK-C",
                    "scrap_area_m2": 0.35, "exception_reason": "",
                    "technician_id": "KTV-003"
                }
                r = complete_request_legacy(request_id, payload, db); db.refresh(req)
                steps.append({"step":"WF6_COMPLETE","result":r.get("detail","")})
        else:
            return False
        return True

    for _ in range(max_iter):
        if req.status in ("CLOSED","EXCEPTION_HOLD"): break
        if not _step(): break

    return {
        "status":"success", "final_status": req.status,
        "steps_executed": steps,
        "detail":f"Demo E2E {len(steps)} bước. Trạng thái cuối: {req.status}"
    }

# ═══════════════════════════════════════════════════════════════════════════════
# STATIC FILES
# ═══════════════════════════════════════════════════════════════════════════════
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def get_index():
    idx = os.path.join(static_dir, "index.html")
    return FileResponse(idx) if os.path.exists(idx) else {"message":"No frontend."}
