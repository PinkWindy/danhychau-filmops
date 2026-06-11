import os
import sqlite3
import datetime

from sqlalchemy import create_engine, Column, String, Float, Boolean, Integer, Text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

db_dir = os.path.dirname(os.path.abspath(__file__))


def _default_sqlite_database_url() -> str:
    return f"sqlite:///{os.path.join(db_dir, 'warehouse_demo.db')}"


def _build_database_url() -> str:
    """Ưu tiên biến môi trường DATABASE_URL (Render PostgreSQL, v.v.). Để trống = SQLite local."""
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return _default_sqlite_database_url()
    # Render/Heroku đôi khi gửi postgres:// — SQLAlchemy 2 cần postgresql://
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://") :]
    return raw


DATABASE_URL = _build_database_url()


def database_is_sqlite() -> bool:
    return DATABASE_URL.strip().lower().startswith("sqlite")


def _sqlite_db_file_path() -> str:
    """Đường dẫn file .db khi dùng SQLite (init_db migration thủ công + reset script)."""
    if not database_is_sqlite():
        return ""
    try:
        u = make_url(DATABASE_URL)
        name = (u.database or "warehouse_demo.db").strip()
        if os.path.isabs(name):
            return name
        return os.path.abspath(os.path.join(db_dir, name))
    except Exception:
        return os.path.join(db_dir, "warehouse_demo.db")


DATABASE_PATH = _sqlite_db_file_path() if database_is_sqlite() else ""

if database_is_sqlite():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DbDealer(Base):
    __tablename__ = "dealers"
    dealer_id = Column(String, primary_key=True, index=True)
    dealer_name = Column(String, nullable=False)
    legal_name = Column(String)
    dealer_group = Column(String)
    tax_code = Column(String)
    address = Column(String)
    contact_phone = Column(String)
    contact_person = Column(String)
    email = Column(String)
    status = Column(String, default="ACTIVE")
    created_at = Column(String)
    updated_at = Column(String)
    note = Column(Text)
    # AMIS-style (bổ sung, không xóa cột cũ)
    customer_category = Column(String, default="DEALER")
    address_no = Column(String)
    street = Column(String)
    ward = Column(String)
    city = Column(String)
    full_address = Column(Text)
    amis_customer_code = Column(String)
    dealer_code = Column(String)  # Mã ngắn dùng trong mã đơn: VD LEX-SG, BKH


class DbCustomer(Base):
    __tablename__ = "customers"
    customer_id = Column(String, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    customer_masked = Column(String)
    phone = Column(String)
    phone_masked = Column(String)
    email = Column(String)
    address = Column(Text)
    address_masked = Column(String)
    source_dealer_id = Column(String)
    customer_type = Column(String, default="END_CUSTOMER")
    source_channel = Column(String, default="MANUAL")
    crm_status = Column(String, default="NEW_PENDING_VERIFICATION")
    consent_status = Column(String, default="UNKNOWN")
    created_from_request_id = Column(String)
    status = Column(String, default="ACTIVE")
    created_at = Column(String)
    updated_at = Column(String)
    note = Column(Text)
    # AMIS-style
    customer_category = Column(String, default="RETAIL_CUSTOMER")
    tax_code = Column(String)
    address_no = Column(String)
    street = Column(String)
    ward = Column(String)
    city = Column(String)
    full_address = Column(Text)
    amis_customer_code = Column(String)


class DbVehicleProfile(Base):
    __tablename__ = "vehicle_profiles"
    vehicle_id = Column(String, primary_key=True, index=True)
    vin_number = Column(String, index=True)
    vin_masked = Column(String)
    plate_number = Column(String)
    vehicle_model_code = Column(String)
    model_name = Column(String)
    model_year = Column(Integer)
    color = Column(String)
    customer_id = Column(String)
    dealer_id = Column(String)
    delivery_date = Column(String)
    created_from_request_id = Column(String)
    vehicle_status = Column(String, default="ACTIVE")
    status = Column(String, default="ACTIVE")
    created_at = Column(String)
    updated_at = Column(String)
    note = Column(Text)


class DbLotInventory(Base):
    __tablename__ = "lot_inventory"
    lot_id = Column(String, primary_key=True, index=True)
    material_code = Column(String, nullable=False)
    material_name = Column(String)          # "Phim PPF T-TYPE Solar Gard"
    film_type = Column(String)              # PPF | WINDOW_FILM | GLASS_FILM | OTHER
    manufacturer = Column(String)
    supplier = Column(String)
    invoice_no = Column(String)
    original_width_m = Column(Float)
    original_length_m = Column(Float)
    remaining_length_m = Column(Float)
    storage_location = Column(String)       # "A-RACK-01"
    is_opened = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)
    lot_status = Column(String, default="ACTIVE")
    # NEW: NEW | IN_USE | LOCKED | DEPLETED | CLOSED | CLEARED | SCRAPPED
    locked_by_request_id = Column(String)
    locked_by_workstream_id = Column(String)
    import_date = Column(String)
    # Ghi đè hiển thị / chỉnh sửa meta nhập kho (nếu null → lấy từ bút toán IMPORT_LOT đầu tiên)
    import_performed_by = Column(String)
    import_performed_at = Column(String)
    status = Column(String, default="ACTIVE")   # legacy — keep for compat
    note = Column(Text)


class DbOffcutInventory(Base):
    __tablename__ = "offcut_inventory"
    offcut_id = Column(String, primary_key=True, index=True)
    parent_lot_id = Column(String)
    parent_offcut_id = Column(String)
    material_code = Column(String, nullable=False)
    material_name = Column(String)
    film_type = Column(String)              # PPF | WINDOW_FILM | GLASS_FILM | OTHER
    width_m = Column(Float)
    length_m = Column(Float)
    area_m2 = Column(Float)
    quality_status = Column(String, default="NORMAL")    # GOOD | NORMAL | POOR
    # NEW: AVAILABLE | RESERVED | USED | PARTIALLY_USED | CLEARED | SCRAPPED | LOST | QUALITY_FAILED
    offcut_status = Column(String, default="AVAILABLE")
    is_locked = Column(Boolean, default=False)
    locked_by_request_id = Column(String)
    locked_by_workstream_id = Column(String)
    storage_location = Column(String)
    created_from_request_id = Column(String)
    created_reason = Column(String)
    import_date = Column(String)
    status = Column(String, default="ACTIVE")    # legacy — keep for compat
    note = Column(Text)


class DbRequest(Base):
    """Master request per vehicle. Aggregates all workstreams."""
    __tablename__ = "requests"
    request_id = Column(String, primary_key=True, index=True)
    dealer_id = Column(String)
    customer_id = Column(String)
    customer_name = Column(String)
    vehicle_id = Column(String)
    vin_number = Column(String)
    vehicle_model_code = Column(String)
    material_code = Column(String)           # legacy/primary material
    job_items = Column(String)
    # Status lifecycle
    # DRAFT → STANDARDIZED → NORM_ASSIGNED → ALLOCATED → APPROVED → IN_PROGRESS
    # → PARTIALLY_COMPLETED → WAITING_INVENTORY_COMMIT → CLOSED | EXCEPTION_HOLD
    status = Column(String, default="DRAFT")
    # Legacy single-workstream fields (kept for backward compat)
    is_grouped_cut = Column(Boolean, default=False)
    cut_group_id = Column(String)
    planned_cut_block = Column(String)
    planned_deduction_length_m = Column(Float)
    allocated_source_type = Column(String)
    allocated_source_id = Column(String)
    actual_cut_block = Column(String)
    actual_length_m = Column(Float)
    scrap_area_m2 = Column(Float, default=0.0)
    created_offcut_id = Column(String)
    exception_reason = Column(Text)
    technician_id = Column(String)
    approved_by = Column(String)
    requested_delivery_time = Column(String)
    created_at = Column(String)
    # Multi-workstream flag
    is_multi_workstream = Column(Boolean, default=False)
    # Channel & CRM links
    source_channel = Column(String, default="OCR")
    request_no = Column(String)
    dealer_name = Column(String)
    vin_masked = Column(String)
    service_selection_json = Column(Text)
    norm_application_json = Column(Text)
    contract_no = Column(String)
    request_date = Column(String)
    ocr_source_image = Column(String)
    model_name = Column(String)
    sales_consultant = Column(String)
    sequence_no = Column(String)
    # STT xe trong tháng (đếm từ đầu tháng, tăng theo đơn) — bổ sung sau sequence_no năm
    sequence_no_month = Column(String)


class DbVehicleFilmNorm(Base):
    """Định mức phim cách nhiệt theo dòng xe / khoảng năm model."""
    __tablename__ = "vehicle_film_norms"
    id = Column(Integer, primary_key=True, autoincrement=True)
    norm_id = Column(String, unique=True, index=True, nullable=False)
    film_type = Column(String, nullable=False)
    vehicle_model_code = Column(String, nullable=False, index=True)
    model_year_range = Column(String, nullable=False)
    windshield_size = Column(String)
    windshield_width_cm = Column(Float)
    windshield_length_cm = Column(Float)
    rear_window_size = Column(String)
    rear_window_width_cm = Column(Float)
    rear_window_length_cm = Column(Float)
    front_side_size = Column(String)
    front_side_width_cm = Column(Float)
    front_side_length_cm = Column(Float)
    rear_side_triangle_size = Column(String)
    rear_side_triangle_width_cm = Column(Float)
    rear_side_triangle_length_cm = Column(Float)
    triangle_size = Column(String)
    triangle_width_cm = Column(Float, default=0)
    triangle_length_cm = Column(Float, default=0)
    rear_side_size = Column(String)
    rear_side_width_cm = Column(Float, default=0)
    rear_side_length_cm = Column(Float, default=0)
    sunroof_size = Column(String)
    sunroof_width_cm = Column(Float, default=0)
    sunroof_length_cm = Column(Float, default=0)
    status = Column(String, default="ACTIVE")
    created_at = Column(String)
    updated_at = Column(String)
    note = Column(Text)


class DbMaterialPreference(Base):
    """Ưu tiên mã vật tư theo loại phim + hạng mục kính (hoặc PPF)."""
    __tablename__ = "material_preferences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    preference_id = Column(String, unique=True, index=True, nullable=False)
    film_type = Column(String, nullable=False, index=True)
    job_item = Column(String, nullable=False, index=True)
    preferred_material_code = Column(String, nullable=False)
    material_name = Column(String)
    priority = Column(Integer, default=1)
    status = Column(String, default="ACTIVE")
    effective_from = Column(String)
    effective_to = Column(String)
    note = Column(Text)
    created_at = Column(String)
    updated_at = Column(String)


class DbWorkstream(Base):
    """
    One workstream per service type per request.
    Types: PPF_INSTALLATION, WINDOW_FILM_INSTALLATION, GLASS_FILM_INSTALLATION, FLOOR_MAT_INSTALLATION
    """
    __tablename__ = "workstreams"
    workstream_id = Column(String, primary_key=True, index=True)
    request_id = Column(String, index=True)
    workstream_type = Column(String)       # PPF_INSTALLATION | WINDOW_FILM_INSTALLATION | GLASS_FILM_INSTALLATION | FLOOR_MAT_INSTALLATION
    team_type = Column(String)             # PPF_TEAM | WINDOW_FILM_TEAM | GLASS_FILM_TEAM | FLOOR_MAT_TEAM
    technician_team = Column(String)       # PPF_TEAM_A | WINDOW_FILM_TEAM_B
    assigned_technician_id = Column(String)
    assigned_technician_name = Column(String)
    # Material
    selected_material_code = Column(String)   # T-TYPE / M-TYPE (PPF) or JB20 (WF)
    material_plan = Column(Text)              # JSON for multi-material WF plan
    ppf_type_changed = Column(Boolean, default=False)
    ppf_type_change_reason = Column(Text)
    ppf_allocation_json = Column(Text)  # JSON: nhiều LOT/OFFCUT cho PPF Full xe + hạng mục
    wf_allocation_json = Column(Text)  # JSON: phân bổ WF theo hạng mục kính + nhiều nguồn
    # Planning
    cut_group_id = Column(String)
    planned_cut_block = Column(String)
    planned_deduction_length_m = Column(Float)
    # Allocation
    allocated_source_type = Column(String)    # LOT | OFFCUT
    allocated_source_id = Column(String)
    source_changed = Column(Boolean, default=False)
    source_change_reason = Column(Text)
    # Status
    # PENDING_APPROVAL → APPROVED → ASSIGNED_TO_TECHNICIAN → IN_PROGRESS
    # → ACTUAL_CONFIRMATION_REQUIRED → COMPLETED → CLOSED
    status = Column(String, default="PENDING_APPROVAL")
    actual_confirmation_status = Column(String, default="PENDING")   # PENDING | COMPLETED
    inventory_committed = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)
    # Timing
    started_at = Column(String)
    completed_at = Column(String)
    closed_at = Column(String)
    is_on_time = Column(Boolean)
    delay_minutes = Column(Integer, default=0)
    # Actual results
    actual_cut_block = Column(String)
    actual_width_m = Column(Float)
    actual_length_m = Column(Float)
    actual_area_m2 = Column(Float)
    has_new_offcut = Column(Boolean, default=False)
    offcut_width_m = Column(Float)
    offcut_length_m = Column(Float)
    offcut_quality_status = Column(String)
    offcut_storage_location = Column(String)
    offcut_material_code = Column(String)  # Mã vật tư mảnh dư KTV chọn khi hoàn tất (optional; mặc định theo luồng)
    created_offcut_id = Column(String)
    has_scrap = Column(Boolean, default=False)
    scrap_area_m2 = Column(Float, default=0.0)
    technician_note = Column(Text)
    extra_cut_requested = Column(Boolean, default=False)
    extra_cut_reason = Column(Text)
    extra_cut_wf_allocation_json = Column(Text)  # JSON: phân bổ cắt thêm WF (cùng schema wf_allocation items)
    extra_cut_history_json = Column(Text)  # JSON array: mỗi lần đề xuất (thời điểm, KTV, lý do, wf_allocation)
    floor_mat_plan_json = Column(Text)    # JSON: [{sku, qty}] cho FLOOR_MAT_INSTALLATION
    # Approval
    approved_by = Column(String)
    approved_at = Column(String)
    # Linked job card
    job_card_id = Column(String)
    created_at = Column(String)


class DbJobCard(Base):
    """WF7 Job Progress — now linked to a workstream"""
    __tablename__ = "job_cards"
    job_card_id = Column(String, primary_key=True, index=True)
    request_id = Column(String, index=True)
    workstream_id = Column(String, index=True)       # NEW — links to DbWorkstream
    workstream_type = Column(String)                 # PPF_INSTALLATION | WINDOW_FILM_INSTALLATION
    technician_id = Column(String)
    technician_name = Column(String)
    technician_team = Column(String)
    vehicle_model_code = Column(String)
    material_code = Column(String)
    job_items = Column(String)
    planned_cut_block = Column(String)
    planned_deduction_length_m = Column(Float)
    allocated_source_id = Column(String)
    # Status
    status = Column(String, default="PENDING")
    started_at = Column(String)
    completed_at = Column(String)
    actual_confirmation_status = Column(String, default="PENDING")
    # Delivery
    requested_delivery_time = Column(String)
    is_on_time = Column(Boolean)
    delay_minutes = Column(Integer, default=0)
    created_at = Column(String)
    notes = Column(Text)
    # JSON array of URL strings (e.g. /static/uploads/COMP-xxx.jpg) — ảnh chứng minh hoàn thành thi công
    completion_photos_json = Column(Text)


class DbAuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(String, primary_key=True, index=True)
    transaction_id = Column(String)
    request_id = Column(String)
    workstream_id = Column(String)         # NEW
    workstream_type = Column(String)       # NEW
    cut_group_id = Column(String)
    transaction_type = Column(String)
    transaction_status = Column(String)
    source_type = Column(String)
    source_id = Column(String)
    before_value = Column(Text)
    after_value = Column(Text)
    reason = Column(Text)
    actor = Column(String)
    timestamp = Column(String)


class DbCuttingGroupMatrix(Base):
    __tablename__ = "cutting_group_matrix"
    cut_group_id = Column(String, primary_key=True, index=True)
    vehicle_model_code = Column(String)
    model_year = Column(Integer)
    film_type = Column(String)
    material_code = Column(String)
    job_items = Column(String)
    piece_sizes = Column(String)
    roll_width_cm = Column(Integer)
    cut_block_width_cm = Column(Integer)
    cut_block_length_cm = Column(Integer)
    deduction_length_m = Column(Float)
    deduction_area_m2 = Column(Float)
    grouping_rule = Column(String)
    status = Column(String, default="ACTIVE")


class DbOcrDraft(Base):
    __tablename__ = "ocr_drafts"
    ocr_draft_id = Column(String, primary_key=True, index=True)
    image_file_id = Column(String)
    image_filename = Column(String)
    image_url = Column(String)
    ocr_status = Column(String, default="PENDING")
    extracted_dealer_name = Column(String)
    extracted_customer_name = Column(String)
    extracted_vehicle_model = Column(String)
    extracted_vin = Column(String)
    extracted_plate = Column(String)
    extracted_film_type = Column(String)
    extracted_job_items = Column(String)
    extracted_delivery_time = Column(String)
    extracted_notes = Column(String)
    extracted_ppf_type = Column(String)       # NEW: T-TYPE | M-TYPE
    extracted_services = Column(String)       # NEW: PPF,WINDOW_FILM
    extracted_dealer_address = Column(String)
    extracted_dealer_phone = Column(String)
    extracted_dealer_fax = Column(String)
    extracted_request_no = Column(String)
    extracted_request_date = Column(String)
    extracted_contract_no = Column(String)
    extracted_customer_address = Column(String)
    extracted_customer_phone = Column(String)
    extracted_service_items_json = Column(Text)
    sequence_no = Column(String)
    dealer_resolution_status = Column(String, default="PENDING")
    resolved_dealer_id = Column(String)
    customer_resolution_status = Column(String, default="PENDING")
    resolved_customer_id = Column(String)
    confidence_dealer = Column(Float, default=0.0)
    confidence_customer = Column(Float, default=0.0)
    confidence_vehicle = Column(Float, default=0.0)
    confidence_overall = Column(Float, default=0.0)
    review_status = Column(String, default="PENDING")
    confirmed_by = Column(String)
    confirmed_at = Column(String)
    created_request_id = Column(String)
    created_at = Column(String)
    extra_payload_json = Column(Text)
    sales_consultant = Column(String)


class DbInventoryTransaction(Base):
    """Immutable inventory ledger — admin + system channel."""
    __tablename__ = "inventory_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    transaction_type = Column(String, nullable=False, index=True)
    source_type = Column(String, nullable=False)  # LOT | OFFCUT | MANUAL_ADJUSTMENT
    source_id = Column(String, nullable=False, index=True)
    material_code = Column(String, nullable=False)
    material_name = Column(String)
    width_m = Column(Float)
    length_m = Column(Float)
    area_m2 = Column(Float)
    quantity_m = Column(Float)
    balance_unit = Column(String, default="METER")  # METER | SQUARE_METER | PIECE
    before_balance = Column(Float)
    after_balance = Column(Float)
    before_status = Column(String)
    after_status = Column(String)
    reason = Column(Text)
    related_request_id = Column(String, index=True)
    related_workstream_id = Column(String)
    related_job_card_id = Column(String)
    parent_lot_id = Column(String)
    parent_offcut_id = Column(String)
    performed_by = Column(String, nullable=False)
    performed_role = Column(String, default="ADMIN")
    performed_at = Column(String, nullable=False, index=True)
    channel = Column(String, default="WEB")
    note = Column(Text)


class DbNotification(Base):
    __tablename__ = "notifications"
    notif_id = Column(String, primary_key=True, index=True)
    title = Column(String)
    body = Column(Text)
    notif_type = Column(String)
    related_id = Column(String)
    related_type = Column(String)
    workstream_id = Column(String)         # NEW
    workstream_type = Column(String)       # NEW
    team_type = Column(String)             # NEW
    recipient_role = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(String)


class DbAppUser(Base):
    """Người dùng đăng nhập web (demo: Admin / Quản lý / KTV)."""
    __tablename__ = "app_users"
    user_id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String)
    role = Column(String, nullable=False)  # ADMIN | MANAGER | TECHNICIAN
    is_active = Column(Boolean, default=True)
    created_at = Column(String)


class DbTelegramMessageLog(Base):
    """Log gửi Telegram — dedupe, audit, gửi lại khi FAILED."""
    __tablename__ = "telegram_message_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False, index=True)
    request_id = Column(String, index=True)
    workstream_id = Column(String, index=True)
    job_card_id = Column(String, index=True)
    telegram_group_name = Column(String)
    telegram_chat_id = Column(String)
    message_text = Column(Text)
    telegram_message_id = Column(String)
    send_status = Column(String, nullable=False, index=True)  # SENT | FAILED | SKIPPED
    error_message = Column(Text)
    dedupe_key = Column(Text, nullable=False, index=True)
    created_at = Column(String, nullable=False)
    sent_at = Column(String)


class DbStaff(Base):
    __tablename__ = "staff"
    staff_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    title = Column(String)
    phone_number = Column(String)
    email = Column(String)
    join_date = Column(String)
    skill_level = Column(String)
    status = Column(String, default="ACTIVE")
    created_at = Column(String)


class DbTeam(Base):
    __tablename__ = "teams"
    team_id = Column(String, primary_key=True, index=True)
    team_name = Column(String, nullable=False)
    team_type = Column(String)  # PPF, PCN, etc.
    status = Column(String, default="ACTIVE")
    created_at = Column(String)


class DbTeamMember(Base):
    __tablename__ = "team_members"
    id = Column(String, primary_key=True, index=True)
    team_id = Column(String, index=True)
    staff_id = Column(String, index=True)
    role = Column(String, default="MEMBER")
    created_at = Column(String)


class DbFloorMatInventory(Base):
    """Kho thảm trải sàn — quản lý theo số lượng (bộ/cái), không theo LOT/offcut."""
    __tablename__ = "floor_mat_inventory"
    sku           = Column(String, primary_key=True)
    name          = Column(String, nullable=False)
    unit          = Column(String, default="bộ")    # cái | bộ
    qty_total     = Column(Integer, default=0)       # Tổng tồn kho thực
    qty_reserved  = Column(Integer, default=0)       # Đang giữ chờ thi công
    min_stock     = Column(Integer, default=5)
    supplier      = Column(String)
    note          = Column(Text)
    created_at    = Column(String)


class DbFloorMatTransaction(Base):
    """Nhật ký giao dịch kho thảm sàn: nhập / giữ chỗ / xác nhận trừ / giải phóng."""
    __tablename__ = "floor_mat_transactions"
    tx_id         = Column(String, primary_key=True)
    sku           = Column(String, nullable=False, index=True)
    request_id    = Column(String, index=True)
    workstream_id = Column(String, index=True)
    tx_type       = Column(String)    # IMPORT | RESERVE | CONFIRM_DEDUCT | RELEASE
    quantity      = Column(Integer)
    performed_by  = Column(String)
    note          = Column(Text)
    created_at    = Column(String)


def _add_column_if_missing(conn, table, col, col_def):
    """SQLite helper: add column only if it doesn't exist yet."""
    cursor = conn.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    if col not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")


def init_db():
    """Create tables and add any missing columns (safe migration for SQLite)."""
    Base.metadata.create_all(bind=engine)
    # PostgreSQL: schema đủ từ models — không chạy PRAGMA/ALTER kiểu SQLite.
    if not database_is_sqlite():
        return
    # SQLite doesn't auto-add new columns via create_all — do it manually
    if DATABASE_PATH and os.path.exists(DATABASE_PATH):
        conn = sqlite3.connect(DATABASE_PATH)
        lot_new_cols = [
            ("material_name",           "TEXT"),
            ("film_type",               "TEXT"),
            ("manufacturer",            "TEXT"),
            ("supplier",                "TEXT"),
            ("invoice_no",              "TEXT"),
            ("storage_location",        "TEXT"),
            ("lot_status",              "TEXT DEFAULT 'ACTIVE'"),
            ("locked_by_request_id",    "TEXT"),
            ("locked_by_workstream_id", "TEXT"),
            ("note",                    "TEXT"),
            ("import_performed_by",     "TEXT"),
            ("import_performed_at",     "TEXT"),
        ]
        for col, col_def in lot_new_cols:
            _add_column_if_missing(conn, "lot_inventory", col, col_def)

        offcut_new_cols = [
            ("parent_offcut_id",         "TEXT"),
            ("material_name",            "TEXT"),
            ("film_type",                "TEXT"),
            ("quality_status",           "TEXT DEFAULT 'NORMAL'"),
            ("offcut_status",            "TEXT DEFAULT 'AVAILABLE'"),
            ("locked_by_request_id",     "TEXT"),
            ("locked_by_workstream_id",  "TEXT"),
            ("created_from_request_id",  "TEXT"),
            ("created_reason",           "TEXT"),
            ("note",                     "TEXT"),
        ]
        for col, col_def in offcut_new_cols:
            _add_column_if_missing(conn, "offcut_inventory", col, col_def)

        dealer_new_cols = [
            ("legal_name", "TEXT"),
            ("dealer_group", "TEXT"),
            ("tax_code", "TEXT"),
            ("contact_person", "TEXT"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
            ("note", "TEXT"),
            ("customer_category", "TEXT DEFAULT 'DEALER'"),
            ("address_no", "TEXT"),
            ("street", "TEXT"),
            ("ward", "TEXT"),
            ("city", "TEXT"),
            ("full_address", "TEXT"),
            ("amis_customer_code", "TEXT"),
            ("dealer_code", "TEXT"),
        ]
        for col, col_def in dealer_new_cols:
            _add_column_if_missing(conn, "dealers", col, col_def)

        customer_new_cols = [
            ("customer_masked", "TEXT"),
            ("phone_masked", "TEXT"),
            ("address_masked", "TEXT"),
            ("address", "TEXT"),
            ("customer_type", "TEXT DEFAULT 'END_CUSTOMER'"),
            ("source_channel", "TEXT DEFAULT 'MANUAL'"),
            ("crm_status", "TEXT DEFAULT 'NEW_PENDING_VERIFICATION'"),
            ("consent_status", "TEXT DEFAULT 'UNKNOWN'"),
            ("created_from_request_id", "TEXT"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
            ("note", "TEXT"),
            ("customer_category", "TEXT DEFAULT 'RETAIL_CUSTOMER'"),
            ("tax_code", "TEXT"),
            ("address_no", "TEXT"),
            ("street", "TEXT"),
            ("ward", "TEXT"),
            ("city", "TEXT"),
            ("full_address", "TEXT"),
            ("amis_customer_code", "TEXT"),
        ]
        for col, col_def in customer_new_cols:
            _add_column_if_missing(conn, "customers", col, col_def)

        vehicle_new_cols = [
            ("vin_masked", "TEXT"),
            ("model_name", "TEXT"),
            ("delivery_date", "TEXT"),
            ("created_from_request_id", "TEXT"),
            ("vehicle_status", "TEXT DEFAULT 'ACTIVE'"),
            ("created_at", "TEXT"),
            ("updated_at", "TEXT"),
            ("note", "TEXT"),
        ]
        for col, col_def in vehicle_new_cols:
            _add_column_if_missing(conn, "vehicle_profiles", col, col_def)

        request_new_cols = [
            ("source_channel", "TEXT DEFAULT 'OCR'"),
            ("request_no", "TEXT"),
            ("dealer_name", "TEXT"),
            ("vin_masked", "TEXT"),
            ("service_selection_json", "TEXT"),
            ("norm_application_json", "TEXT"),
        ]
        for col, col_def in request_new_cols:
            _add_column_if_missing(conn, "requests", col, col_def)

        request_more_cols = [
            ("contract_no", "TEXT"),
            ("request_date", "TEXT"),
            ("ocr_source_image", "TEXT"),
            ("model_name", "TEXT"),
            ("sales_consultant", "TEXT"),
            ("sequence_no_month", "TEXT"),
        ]
        for col, col_def in request_more_cols:
            _add_column_if_missing(conn, "requests", col, col_def)

        ocr_draft_cols = [
            ("extra_payload_json", "TEXT"),
            ("sales_consultant", "TEXT"),
            ("extracted_dealer_address", "TEXT"),
            ("extracted_dealer_phone", "TEXT"),
            ("extracted_dealer_fax", "TEXT"),
            ("extracted_request_no", "TEXT"),
            ("extracted_request_date", "TEXT"),
            ("extracted_contract_no", "TEXT"),
            ("extracted_customer_address", "TEXT"),
            ("extracted_customer_phone", "TEXT"),
            ("extracted_service_items_json", "TEXT"),
            ("dealer_resolution_status", "TEXT DEFAULT 'PENDING'"),
            ("resolved_dealer_id", "TEXT"),
            ("customer_resolution_status", "TEXT DEFAULT 'PENDING'"),
            ("resolved_customer_id", "TEXT"),
        ]
        for col, col_def in ocr_draft_cols:
            _add_column_if_missing(conn, "ocr_drafts", col, col_def)

        workstream_new_cols = [
            ("ppf_allocation_json", "TEXT"),
            ("wf_allocation_json", "TEXT"),
            ("offcut_material_code", "TEXT"),
            ("extra_cut_requested", "BOOLEAN DEFAULT 0"),
            ("extra_cut_reason", "TEXT"),
            ("extra_cut_wf_allocation_json", "TEXT"),
            ("extra_cut_history_json", "TEXT"),
            ("floor_mat_plan_json", "TEXT"),
        ]
        for col, col_def in workstream_new_cols:
            _add_column_if_missing(conn, "workstreams", col, col_def)

        job_card_new_cols = [
            ("completion_photos_json", "TEXT"),
        ]
        for col, col_def in job_card_new_cols:
            _add_column_if_missing(conn, "job_cards", col, col_def)

        # Gỡ định mức demo tự tạo cũ — định mức phim cách nhiệt chỉ do người dùng nhập / import thủ công.
        try:
            cur = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='vehicle_film_norms'"
            )
            if cur.fetchone():
                conn.execute(
                    "DELETE FROM vehicle_film_norms WHERE norm_id IN (?, ?)",
                    ("NORM-DEMO-RX350-WF-2024-2027", "NORM-RX350-2013-2022"),
                )
                # Định mức do smoke/script POST — không giữ trên DB vận hành
                conn.execute(
                    "DELETE FROM vehicle_film_norms WHERE norm_id LIKE ? OR norm_id LIKE ?",
                    ("NORM-SMOKE-%", "NORM-SEED-SMOKE-%"),
                )
        except Exception:
            pass

        conn.commit()
        conn.close()


if __name__ == "__main__":
    init_db()
    print("Database tables initialized successfully.")
