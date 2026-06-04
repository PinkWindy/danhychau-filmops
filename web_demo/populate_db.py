import os
import csv
import json
import datetime
from sqlalchemy import text
from database import SessionLocal, init_db, DbDealer, DbCustomer, DbVehicleProfile, DbLotInventory, DbOffcutInventory, DbCuttingGroupMatrix, DbRequest, DbAuditLog, DbWorkstream, DbNotification, DbInventoryTransaction

def map_lot_id(old_id):
    if not old_id:
        return old_id
    val = old_id.strip()
    val = val.replace("LOT-FILMA-001", "LOT-JB20-001")
    val = val.replace("LOT-FILMA-002", "LOT-JB20-002")
    val = val.replace("LOT-FILMB-001", "LOT-JB20-003")
    return val

def map_offcut_id(old_id):
    if not old_id:
        return old_id
    val = old_id.strip()
    val = val.replace("SUBLOT-FILMA-001", "SUBLOT-JB20-001")
    val = val.replace("SUBLOT-FILMA-002", "SUBLOT-JB20-002")
    val = val.replace("SUBLOT-FILMB-001", "SUBLOT-JB20-003")
    return val


def _mat_slug(material_code: str) -> str:
    return material_code.replace("-", "")


def _lexus_web_vehicle_rows():
    """Xe Lexus tại đại lý SG — gắn 4 đơn gửi về công ty (web demo)."""
    return [
        DbVehicleProfile(
            vehicle_id="VEH_LEX_CO_001",
            vin_number="VIN_LEX_WEB_NX350_001",
            plate_number="51L-88001",
            vehicle_model_code="LEXUS_NX350",
            model_year=2026,
            color="Ghi bạc",
            customer_id="CUST_001",
            dealer_id="DEALER_LEXUS_SG",
            status="ACTIVE",
        ),
        DbVehicleProfile(
            vehicle_id="VEH_LEX_CO_002",
            vin_number="VIN_LEX_WEB_ES250_001",
            plate_number="51L-88002",
            vehicle_model_code="LEXUS_ES250",
            model_year=2026,
            color="Đen",
            customer_id="CUST_001",
            dealer_id="DEALER_LEXUS_SG",
            status="ACTIVE",
        ),
        DbVehicleProfile(
            vehicle_id="VEH_LEX_CO_003",
            vin_number="VIN_LEX_WEB_RX350_002",
            plate_number="51L-88003",
            vehicle_model_code="LEXUS_RX350",
            model_year=2026,
            color="Trắng ngọc",
            customer_id="CUST_007",
            dealer_id="DEALER_LEXUS_SG",
            status="ACTIVE",
        ),
        DbVehicleProfile(
            vehicle_id="VEH_LEX_CO_004",
            vin_number="VIN_LEX_WEB_LX600_001",
            plate_number="51L-88004",
            vehicle_model_code="LEXUS_LX600",
            model_year=2026,
            color="Đen",
            customer_id="CUST_001",
            dealer_id="DEALER_LEXUS_SG",
            status="ACTIVE",
        ),
    ]


def _ensure_five_lots_per_material(db):
    """Đảm bảo khoảng 5 cuộn LOT / material_code (JB20, RT40, RS20, T-TYPE, M-TYPE) cho demo kho."""
    defs = [
        ("JB20", "WINDOW_FILM", "Phim cách nhiệt JB20 (nhập Lexus SG)", 1.52, 30.0),
        ("RT40", "WINDOW_FILM", "Phim kính lái RT40", 1.52, 30.0),
        ("RS20", "WINDOW_FILM", "Phim RS20", 1.52, 30.0),
        ("T-TYPE", "PPF", "Phim PPF T-TYPE", 1.52, 15.0),
        ("M-TYPE", "PPF", "Phim PPF M-TYPE", 1.52, 15.0),
    ]
    for mat, ftype, mname, ow, ol in defs:
        slug = _mat_slug(mat)
        n = db.query(DbLotInventory).filter(DbLotInventory.material_code == mat).count()
        for idx in range(n, 5):
            seq = idx + 1
            lot_id = f"LOT-LEX-CO-{slug}-{seq:02d}"
            rem = round(ol * (0.82 + 0.04 * (seq % 4)), 2)
            rem = min(rem, ol)
            opened = rem < ol - 0.05
            db.add(
                DbLotInventory(
                    lot_id=lot_id,
                    material_code=mat,
                    material_name=mname,
                    film_type=ftype,
                    manufacturer="Konica",
                    supplier="Lexus Trung Tâm Sài Gòn",
                    invoice_no=f"INV-LEX-{slug}-{seq:02d}",
                    original_width_m=ow,
                    original_length_m=ol,
                    remaining_length_m=rem,
                    storage_location=f"LEX-IN-{slug[:4]}-R{seq:02d}",
                    is_opened=opened,
                    is_locked=False,
                    lot_status="IN_USE" if opened else "NEW",
                    import_date=datetime.date.today().isoformat(),
                    status="ACTIVE",
                    note="Seed: đơn hàng Lexus đại lý gửi kho DYC",
                )
            )


def clean_and_load_csv():
    init_db()
    db = SessionLocal()
    
    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    knowledge_dir = os.path.join(_root, "knowledge")
    
    # 1. Load Dealers
    db.query(DbDealer).delete()
    dealer_path = os.path.join(knowledge_dir, "dealer_account_master.csv")
    if os.path.exists(dealer_path):
        with open(dealer_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                dealer = DbDealer(
                    dealer_id=row['dealer_id'],
                    dealer_name=row['dealer_name'],
                    address=row['address'],
                    contact_phone=row['contact_phone'],
                    email=row.get('contact_email', ''),
                    status=row['status']
                )
                db.add(dealer)
        print("Dealers loaded.")

    # 2. Load Customers
    db.query(DbCustomer).delete()
    customer_path = os.path.join(knowledge_dir, "end_customer_master.csv")
    if os.path.exists(customer_path):
        with open(customer_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                customer = DbCustomer(
                    customer_id=row['customer_id'],
                    customer_name=row['customer_name'],
                    phone=row['phone'],
                    email=row['email'],
                    source_dealer_id=row['source_dealer_id'],
                    status="ACTIVE"
                )
                db.add(customer)
        print("Customers loaded.")

    # 3. Load Vehicle Profiles
    db.query(DbVehicleProfile).delete()
    vp_path = os.path.join(knowledge_dir, "vehicle_profile_master.csv")
    if os.path.exists(vp_path):
        with open(vp_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                vp = DbVehicleProfile(
                    vehicle_id=row['vehicle_id'],
                    vin_number=row['vin_number'],
                    plate_number="30K-XXXXX",
                    vehicle_model_code=row['vehicle_model_code'],
                    model_year=2026,
                    color="Màu chuẩn",
                    customer_id=row['customer_id'],
                    dealer_id=row['dealer_id'],
                    status=row['status']
                )
                db.add(vp)
        print("Vehicle Profiles loaded.")

    for vp in _lexus_web_vehicle_rows():
        db.add(vp)
    print("Lexus inbound showcase vehicles added.")

    # 4. Load LOT Inventory
    db.query(DbLotInventory).delete()
    lot_path = os.path.join(knowledge_dir, "lot_inventory.csv")
    if os.path.exists(lot_path):
        with open(lot_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                lot_id = map_lot_id(row['lot_id'])
                lot = DbLotInventory(
                    lot_id=lot_id,
                    material_code=row['material_code'],
                    original_width_m=float(row['original_width_m']),
                    original_length_m=float(row['original_length_m']),
                    remaining_length_m=float(row['remaining_length_m']),
                    is_opened=(row['is_opened'].lower() == 'true'),
                    is_locked=(row['is_locked'].lower() == 'true'),
                    import_date=row['import_date'],
                    status=row['status'],
                    storage_location=row.get('storage_location') or "A-RACK-01",
                    lot_status="IN_USE" if row['is_opened'].lower() == 'true' else "NEW",
                    film_type="WINDOW_FILM",
                )
                db.add(lot)
        print("LOT Inventory loaded.")

    # 5. Load Offcuts
    db.query(DbOffcutInventory).delete()
    offcut_path = os.path.join(knowledge_dir, "offcut_inventory.csv")
    if os.path.exists(offcut_path):
        with open(offcut_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                offcut_id = map_offcut_id(row['offcut_id'])
                parent_lot_id = map_lot_id(row['parent_lot_id'])
                offcut = DbOffcutInventory(
                    offcut_id=offcut_id,
                    parent_lot_id=parent_lot_id,
                    material_code=row['material_code'],
                    width_m=float(row['width_m']),
                    length_m=float(row['length_m']),
                    area_m2=float(row['area_m2']),
                    is_locked=(row['is_locked'].lower() == 'true'),
                    storage_location=row['storage_location'],
                    import_date=row['import_date'],
                    status=row['status'],
                    offcut_status="AVAILABLE",
                    quality_status="GOOD",
                    film_type="WINDOW_FILM",
                )
                db.add(offcut)
        print("Offcut Inventory loaded.")

    # 5b. Inventory admin demo + ledger seed
    db.query(DbInventoryTransaction).delete()
    ts = datetime.datetime.utcnow().isoformat() + "Z"
    demo_tx = [
        DbInventoryTransaction(
            transaction_id="INV-TXN-SEED-MANUAL-ISSUE-001",
            transaction_type="MANUAL_ISSUE_LOT",
            source_type="LOT",
            source_id="LOT-JB20-002",
            material_code="JB20",
            material_name=None,
            width_m=1.52,
            length_m=0.5,
            area_m2=None,
            quantity_m=0.5,
            balance_unit="METER",
            before_balance=20.0,
            after_balance=19.5,
            before_status="IN_USE",
            after_status="IN_USE",
            reason="Xuất mẫu nội bộ (seed)",
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=None,
            parent_offcut_id=None,
            performed_by="QL-002",
            performed_role="MANAGER",
            performed_at=ts,
            channel="WEB",
            note="populate_db seed",
        ),
        DbInventoryTransaction(
            transaction_id="INV-TXN-SEED-RELEASE-001",
            transaction_type="RELEASE_LOCK_MANUAL",
            source_type="LOT",
            source_id="LOT-DEMO-LOCKED-001",
            material_code="JB20",
            material_name=None,
            width_m=1.52,
            length_m=30.0,
            area_m2=None,
            quantity_m=None,
            balance_unit="METER",
            before_balance=None,
            after_balance=None,
            before_status="locked=true",
            after_status="is_locked=false",
            reason="Đơn demo hủy (seed)",
            related_request_id="REQ-DEMO-CANCELLED",
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id=None,
            parent_offcut_id=None,
            performed_by="QL-002",
            performed_role="MANAGER",
            performed_at=ts,
            channel="WEB",
            note="populate_db seed",
        ),
        DbInventoryTransaction(
            transaction_id="INV-TXN-SEED-CLEAR-OFFCUT-001",
            transaction_type="CLEAR_OFFCUT",
            source_type="OFFCUT",
            source_id="SUBLOT-SEED-CLEARED-001",
            material_code="JB20",
            material_name=None,
            width_m=0.0,
            length_m=0.0,
            area_m2=0.0,
            quantity_m=1.52,
            balance_unit="SQUARE_METER",
            before_balance=1.52,
            after_balance=0.0,
            before_status="AVAILABLE",
            after_status="CLEARED",
            reason="Kiểm kê mất mảnh (seed)",
            related_request_id=None,
            related_workstream_id=None,
            related_job_card_id=None,
            parent_lot_id="LOT-JB20-001",
            parent_offcut_id=None,
            performed_by="QL-002",
            performed_role="MANAGER",
            performed_at=ts,
            channel="WEB",
            note="populate_db seed",
        ),
    ]
    for t in demo_tx:
        db.add(t)

    db.add(DbLotInventory(
        lot_id="LOT-DEMO-LOCKED-001",
        material_code="JB20",
        material_name="Phim JB20 — demo soft lock",
        film_type="WINDOW_FILM",
        manufacturer="Konica",
        supplier="Konica",
        invoice_no="INV-DEMO-LOCK-001",
        original_width_m=1.52,
        original_length_m=30.0,
        remaining_length_m=30.0,
        storage_location="A-RACK-DEMO-LOCK",
        is_opened=False,
        is_locked=True,
        locked_by_request_id="REQ-DEMO-CANCELLED",
        locked_by_workstream_id="WS-DEMO-OLD",
        lot_status="LOCKED",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note="Seed: thử Release Lock",
    ))
    db.add(DbLotInventory(
        lot_id="LOT-DEMO-CLEAR-001",
        material_code="JB20",
        material_name="Phim JB20 — demo clear",
        film_type="WINDOW_FILM",
        manufacturer="Konica",
        supplier="Konica",
        invoice_no="INV-DEMO-CLEAR-001",
        original_width_m=1.52,
        original_length_m=15.0,
        remaining_length_m=0.42,
        storage_location="A-RACK-DEMO-CLEAR",
        is_opened=True,
        is_locked=False,
        lot_status="IN_USE",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note="Seed: thử Clear LOT",
    ))
    db.add(DbOffcutInventory(
        offcut_id="SUBLOT-DEMO-LOCKED-001",
        parent_lot_id="LOT-JB20-001",
        material_code="JB20",
        material_name="JB20 offcut demo lock",
        film_type="WINDOW_FILM",
        width_m=1.52,
        length_m=1.5,
        area_m2=round(1.52 * 1.5, 3),
        quality_status="GOOD",
        offcut_status="AVAILABLE",
        is_locked=True,
        locked_by_request_id="REQ-DEMO-CANCELLED",
        locked_by_workstream_id=None,
        storage_location="OFFCUT-RACK-DEMO",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note="Seed: Release Lock offcut",
    ))
    db.add(DbOffcutInventory(
        offcut_id="SUBLOT-DEMO-QUALITY-FAILED-001",
        parent_lot_id="LOT-JB20-001",
        material_code="JB20",
        material_name="JB20 offcut demo QC — dùng tab Clear",
        film_type="WINDOW_FILM",
        width_m=1.52,
        length_m=1.5,
        area_m2=round(1.52 * 1.5, 3),
        quality_status="POOR",
        offcut_status="AVAILABLE",
        is_locked=False,
        storage_location="OFFCUT-RACK-DEMO",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note="Seed: demo Clear OFFCUT (QUALITY_FAILED)",
    ))
    db.add(DbOffcutInventory(
        offcut_id="SUBLOT-SEED-CLEARED-001",
        parent_lot_id="LOT-JB20-001",
        material_code="JB20",
        material_name="Đã clear — chỉ xem ledger",
        film_type="WINDOW_FILM",
        width_m=0.0,
        length_m=0.0,
        area_m2=0.0,
        quality_status="NORMAL",
        offcut_status="CLEARED",
        is_locked=False,
        storage_location="OFFCUT-RACK-DEMO",
        import_date=datetime.date.today().isoformat(),
        status="ACTIVE",
        note="Seed: ví dụ CLEAR_OFFCUT trong bảng giao dịch",
    ))

    db.flush()
    _ensure_five_lots_per_material(db)
    print("LOT inventory topped up to ~5 rolls per material (JB20/RT40/RS20/T-TYPE/M-TYPE).")

    # 6. Load Cutting Group Matrix
    db.query(DbCuttingGroupMatrix).delete()
    cg_path = os.path.join(knowledge_dir, "cutting_group_matrix.csv")
    if os.path.exists(cg_path):
        with open(cg_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                cg = DbCuttingGroupMatrix(
                    cut_group_id=row['cut_group_id'],
                    vehicle_model_code=row['vehicle_model_code'],
                    model_year=int(row['model_year']),
                    film_type=row['film_type'],
                    material_code=row['material_code'],
                    job_items=row['job_items'],
                    piece_sizes=row['piece_sizes'],
                    roll_width_cm=int(row['roll_width_cm']),
                    cut_block_width_cm=int(row['cut_block_width_cm']),
                    cut_block_length_cm=int(row['cut_block_length_cm']),
                    deduction_length_m=float(row['deduction_length_m']),
                    deduction_area_m2=float(row['deduction_area_m2']),
                    grouping_rule=row['grouping_rule'],
                    status=row['status']
                )
                db.add(cg)
        print("Cutting Group Matrix loaded.")

    # 7. Add sample requests
    db.query(DbRequest).delete()
    reqs = [
        # 4 đơn Lexus đại lý gửi về công ty (hiển thị web — created_at mới nhất)
        DbRequest(
            request_id="REQ-LEXUS-CO-20260611-004",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_LEXUS_MASKED_LX",
            vehicle_id="VEH_LEX_CO_004",
            vin_number="VIN_LEX_WEB_LX600_001",
            vehicle_model_code="LEXUS_LX600",
            material_code="JB20",
            job_items="JOB_FILM_WINDSHIELD;JOB_FILM_SIDE",
            status="ALLOCATED",
            is_grouped_cut=False,
            planned_cut_block="152x160",
            planned_deduction_length_m=1.6,
            allocated_source_type="LOT",
            allocated_source_id="LOT-JB20-001",
            requested_delivery_time="2026-06-12T15:00:00Z",
            created_at="2026-06-11 14:45:00",
        ),
        DbRequest(
            request_id="REQ-LEXUS-CO-20260611-003",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_007",
            customer_name="KH_LEXUS_MASKED_RX",
            vehicle_id="VEH_LEX_CO_003",
            vin_number="VIN_LEX_WEB_RX350_002",
            vehicle_model_code="LEXUS_RX350",
            material_code="JB20",
            job_items="JOB_FILM_SIDE;JOB_FILM_REAR",
            status="NORM_ASSIGNED",
            is_grouped_cut=True,
            cut_group_id="CG_RX350_SIDE_REAR",
            planned_cut_block="152x143",
            planned_deduction_length_m=1.43,
            requested_delivery_time="2026-06-12T11:00:00Z",
            created_at="2026-06-11 14:30:00",
        ),
        DbRequest(
            request_id="REQ-LEXUS-CO-20260611-002",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_LEXUS_MASKED_ES",
            vehicle_id="VEH_LEX_CO_002",
            vin_number="VIN_LEX_WEB_ES250_001",
            vehicle_model_code="LEXUS_ES250",
            material_code="JB20",
            job_items="JOB_FILM_SIDE;JOB_FILM_REAR",
            status="STANDARDIZED",
            is_grouped_cut=False,
            requested_delivery_time="2026-06-12T09:00:00Z",
            created_at="2026-06-11 14:15:00",
        ),
        DbRequest(
            request_id="REQ-LEXUS-CO-20260611-001",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_LEXUS_MASKED_NX",
            vehicle_id="VEH_LEX_CO_001",
            vin_number="VIN_LEX_WEB_NX350_001",
            vehicle_model_code="LEXUS_NX350",
            material_code="T-TYPE",
            job_items="JOB_PPF_FULL;JOB_FILM_WINDSHIELD",
            status="DRAFT",
            is_grouped_cut=False,
            requested_delivery_time="2026-06-13T10:00:00Z",
            created_at="2026-06-11 14:00:00",
        ),
        DbRequest(
            request_id="REQ-20260603-001",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_MASKED_001",
            vehicle_id="VEH_001",
            vin_number="VIN_MASKED_RX350_001",
            vehicle_model_code="LEXUS_RX350",
            material_code="JB20",
            job_items="JOB_FILM_SIDE;JOB_FILM_REAR",
            status="DRAFT",
            is_grouped_cut=False,
            created_at="2026-06-03 14:00:00"
        ),
        DbRequest(
            request_id="REQ-20260602-005",
            dealer_id="DEALER_TOYOTA_BENTHANH",
            customer_id="CUST_002",
            customer_name="KH_MASKED_002",
            vehicle_id="VEH_002",
            vin_number="VIN_MASKED_ES250_001",
            vehicle_model_code="LEXUS_ES250",
            material_code="JB20",
            job_items="JOB_FILM_SIDE;JOB_FILM_REAR",
            status="COMPLETED",
            is_grouped_cut=True,
            cut_group_id="CG_ES250_SIDE_REAR",
            planned_cut_block="152x132",
            planned_deduction_length_m=1.32,
            allocated_source_type="LOT",
            allocated_source_id="LOT-JB20-001",
            actual_cut_block="152x132",
            actual_length_m=1.32,
            scrap_area_m2=0.15,
            technician_id="KTV-003",
            approved_by="QL-002",
            created_at="2026-06-02 10:30:00"
        ),
        DbRequest(
            request_id="REQ-20260603-009",
            dealer_id="DEALER_BMW_PHUMYHUNG",
            customer_id="CUST_003",
            customer_name="KH_MASKED_003",
            vehicle_id="VEH_003",
            vin_number="VIN_MASKED_CAMRY_001",
            vehicle_model_code="TOYOTA_CAMRY",
            material_code="RS20",
            job_items="JOB_FILM_SIDE;JOB_FILM_REAR",
            status="ALLOCATED",
            is_grouped_cut=True,
            cut_group_id="CG_CAMRY_SIDE_REAR",
            planned_cut_block="152x132",
            planned_deduction_length_m=1.32,
            allocated_source_type="LOT",
            allocated_source_id="LOT-FILMC-001",
            created_at="2026-06-03 15:45:00"
        ),
        DbRequest(
            request_id="REQ-20260603-015",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_MASKED_004",
            vehicle_id="VEH_001",
            vin_number="VIN_MASKED_LM500H_001",
            vehicle_model_code="LEXUS_LM500H",
            material_code="RS20",
            job_items="JOB_FILM_SIDE",
            status="EXCEPTION_HOLD",
            exception_reason="NORM_LOOKUP_FAILED: Model xe LEXUS_LM500H chua co dinh muc trong matran.",
            created_at="2026-06-03 16:10:00"
        ),
        # NEW: Multi-workstream demo request
        DbRequest(
            request_id="REQ-20260604-001",
            dealer_id="DEALER_LEXUS_SG",
            customer_id="CUST_001",
            customer_name="KH_MASKED_VIP_001",
            vehicle_id="VEH_001",
            vin_number="VIN_MASKED_RX350_VIP",
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
            created_at="2026-06-04 01:00:00"
        )
    ]
    for r in reqs:
        db.add(r)
    
    # 8. Add Workstreams for REQ-20260604-001
    db.query(DbWorkstream).delete()
    wf_plan = json.dumps([
        {"job_item": "WINDSHIELD",         "material_code": "RT40", "note": "Kinh lai co dinh dung RT40"},
        {"job_item": "REAR_WINDOW",        "material_code": "JB20"},
        {"job_item": "FRONT_SIDE",         "material_code": "JB20"},
        {"job_item": "REAR_SIDE_TRIANGLE", "material_code": "JB20"},
        {"job_item": "SUNROOF",            "material_code": "JB20"},
    ], ensure_ascii=False)
    workstreams = [
        DbWorkstream(
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
            allocated_source_id="LOT-JB20-003",
            status="PENDING_APPROVAL",
            actual_confirmation_status="PENDING",
            created_at="2026-06-04T01:00:00Z"
        ),
        DbWorkstream(
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
            created_at="2026-06-04T01:00:00Z"
        ),
    ]
    for ws in workstreams:
        db.add(ws)
    print("Workstreams loaded.")

    # 8b. Đồng bộ tồn LOT demo đa luồng — validate-sources / WF6 cần đủ mét cho PPF
    db.flush()
    db.execute(
        text("UPDATE lot_inventory SET remaining_length_m = original_length_m WHERE lot_id = :lid"),
        {"lid": "LOT-JB20-003"},
    )
    _chk = db.execute(
        text("SELECT remaining_length_m FROM lot_inventory WHERE lot_id = :lid"),
        {"lid": "LOT-JB20-003"},
    ).fetchone()
    print(f"PPF demo LOT-JB20-003 remaining synced to {_chk[0] if _chk else '?'}.")

    # 9. Add initial notifications
    db.query(DbNotification).delete()
    db.add(DbNotification(
        notif_id="NOTIF-SEED-001",
        title="Xe VIP can phe duyet 2 workstream",
        body="REQ-20260604-001 (LEXUS_RX350) — Can duyet PPF va Window Film cho khach VIP.",
        notif_type="APPROVAL_NEEDED",
        related_id="REQ-20260604-001",
        related_type="REQUEST",
        workstream_id=None,
        workstream_type=None,
        team_type=None,
        recipient_role="MANAGER",
        is_read=False,
        created_at="2026-06-04T01:00:00Z"
    ))
    print("Notifications seeded.")

    # 10. Add sample audit logs
    db.query(DbAuditLog).delete()
    logs = [
        DbAuditLog(
            log_id="AUD-20260602-001",
            transaction_id="TXN-20260602-001",
            request_id="REQ-20260602-005",
            cut_group_id="CG_ES250_SIDE_REAR",
            transaction_type="ISSUE_FROM_LOT",
            transaction_status="CONFIRMED",
            source_type="LOT",
            source_id="LOT-JB20-001",
            before_value="15.0m",
            after_value="13.68m",
            reason="KTV-003 xac nhan da cat block 152x132 cho ES250",
            actor="KTV-003",
            timestamp="2026-06-02T11:45:00Z"
        ),
        DbAuditLog(
            log_id="AUD-20260602-002",
            transaction_id="TXN-20260602-002",
            request_id="REQ-20260602-005",
            transaction_type="RECORD_SCRAP",
            transaction_status="CONFIRMED",
            source_type="LOT",
            source_id="LOT-JB20-001",
            before_value="0.0m2",
            after_value="0.15m2",
            reason="KTV-003 ghi nhan scrap phat sinh tu margin sấy dán",
            actor="KTV-003",
            timestamp="2026-06-02T11:45:10Z"
        )
    ]
    for l in logs:
        db.add(l)
        
    db.commit()
    db.close()
    print("Database populated successfully.")

if __name__ == "__main__":
    clean_and_load_csv()
