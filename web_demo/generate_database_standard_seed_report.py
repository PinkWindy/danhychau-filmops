# -*- coding: utf-8 -*-
"""
Sinh báo cáo nghiệm thu seed chuẩn: audit/database-standard-seed-report.md

- Không gọi reset DB. Chỉ đọc DB hiện tại + chạy smoke (có thể ghi audit/notification tùy smoke).
- Nếu `database_seed_integrity_smoke_test.py` đã PASS: không yêu cầu reset (script cũng không reset).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPORT_PATH = HERE / "audit" / "database-standard-seed-report.md"
CANONICAL_XLSX = Path(r"D:\Quản lý vận hành DYC\Phim cách nhiệt - Định mức chuẩn.xlsx")

os.chdir(str(HERE))
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from sqlalchemy import or_  # noqa: E402

from database import (  # noqa: E402
    DbAuditLog,
    DbCustomer,
    DbDealer,
    DbInventoryTransaction,
    DbJobCard,
    DbLotInventory,
    DbMaterialPreference,
    DbOcrDraft,
    DbOffcutInventory,
    DbRequest,
    DbVehicleFilmNorm,
    DbVehicleProfile,
    DbWorkstream,
    SessionLocal,
    init_db,
)
from film_norm_excel_import import (  # noqa: E402
    analyze_excel_norm_workbook,
)
from material_preference_logic import resolve_material_preference  # noqa: E402
from vehicle_norm_logic import resolve_vehicle_norm_with_year_fallback  # noqa: E402

FT_WF = "Phim cách nhiệt"
FT_PPF = "PPF"

DEMO_REQUEST_META = {
    "REQ-DEMO-PENDING-PPF-WF": (
        "Đơn đã phân bổ PPF + Window Film, chờ QL duyệt",
        "Phê duyệt từng workstream / kiểm tra allocation",
    ),
    "REQ-DEMO-IN-PROGRESS": ("KTV đã bắt đầu thi công", "Tiếp tục job / actual"),
    "REQ-DEMO-PARTIAL": ("Một đội xong, một đội còn làm", "Hoàn tất WF còn lại"),
    "REQ-DEMO-CLOSED": ("Đơn hoàn tất, có ledger + audit", "Xem báo cáo / audit"),
    "REQ-DEMO-NEEDS-REVIEW": ("Thiếu norm hoặc preference", "Bổ sung định mức / Material Preference"),
    "REQ-DEMO-EXCEPTION-HOLD": ("Exception nguồn vật tư", "QL xử lý exception"),
    "REQ-20260604-001": ("Legacy VIP + validate-sources (smoke inventory)", "Phê duyệt / thi công demo"),
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _subrun(script: str, needle: str) -> tuple[bool, int, str]:
    p = subprocess.run(
        [sys.executable, script],
        cwd=str(HERE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (p.stdout or "") + "\n" + (p.stderr or "")
    ok = p.returncode == 0 and needle in out
    return ok, p.returncode, out


def _counts(db) -> dict[str, int]:
    return {
        "dealers": db.query(DbDealer).count(),
        "end_customers": db.query(DbCustomer).count(),
        "vehicle_profiles": db.query(DbVehicleProfile).count(),
        "vehicle_film_norms": db.query(DbVehicleFilmNorm).count(),
        "material_preferences": db.query(DbMaterialPreference).count(),
        "lots": db.query(DbLotInventory).count(),
        "offcuts": db.query(DbOffcutInventory).count(),
        "ocr_drafts": db.query(DbOcrDraft).count(),
        "requests": db.query(DbRequest).count(),
        "workstreams": db.query(DbWorkstream).count(),
        "job_cards": db.query(DbJobCard).count(),
        "inventory_transactions": db.query(DbInventoryTransaction).count(),
        "audit_logs": db.query(DbAuditLog).count(),
    }


def _excel_norm_db_count(db) -> int:
    return (
        db.query(DbVehicleFilmNorm)
        .filter(or_(DbVehicleFilmNorm.norm_id.like("NORM-XLS%"), DbVehicleFilmNorm.note.like("%Import Excel%")))
        .count()
    )


def _sample_norms(db, limit: int = 10) -> list[DbVehicleFilmNorm]:
    q = (
        db.query(DbVehicleFilmNorm)
        .filter(DbVehicleFilmNorm.film_type != "PPF")
        .filter(or_(DbVehicleFilmNorm.norm_id.like("NORM-XLS%"), DbVehicleFilmNorm.note.like("%Import Excel%")))
        .order_by(DbVehicleFilmNorm.vehicle_model_code, DbVehicleFilmNorm.model_year_range)
    )
    rows = q.limit(limit).all()
    if len(rows) >= limit:
        return rows
    q2 = (
        db.query(DbVehicleFilmNorm)
        .filter(DbVehicleFilmNorm.film_type != "PPF")
        .order_by(DbVehicleFilmNorm.norm_id)
        .limit(limit)
    )
    return q2.all()


def _mat_resolve_db(db, film_type: str, job_item: str) -> dict:
    return resolve_material_preference(db, film_type, job_item)


def _resolve_case_db(db, model: str, year: int, film: str) -> dict:
    try:
        return resolve_vehicle_norm_with_year_fallback(db, model, year, film)
    except Exception as e:
        return {"found": False, "_crash": True, "_error": str(e)}


def _ppf_norm_row(db) -> DbVehicleFilmNorm | None:
    return db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == "NORM-PPF-ALL-ALL-DEFAULT").first()


def _ocr_checks(db) -> dict:
    out = {}
    for did in ("OCR-DRAFT-LEXUS-115-NEW", "OCR-DRAFT-LEXUS-117-NEW"):
        row = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == did).first()
        if not row:
            out[did] = {"exists": False}
            continue
        demo_ok = False
        try:
            pl = json.loads(row.extra_payload_json or "{}")
            blob = (
                str(pl.get("customer_name", ""))
                + str(pl.get("customer_masked", ""))
                + str(pl.get("vin_number", ""))
                + str(pl.get("vin_masked", ""))
            )
            vin_demo = pl.get("vin_number") or pl.get("vin_masked") or ""
            demo_ok = ("MASKED" not in blob.upper()) and len(str(vin_demo).strip()) >= 17
        except json.JSONDecodeError:
            pass
        out[did] = {
            "exists": True,
            "review_status": row.review_status,
            "ocr_status": row.ocr_status,
            "created_request_id": (row.created_request_id or "").strip(),
            "masked_payload": demo_ok,
        }
    return out


def _demo_request_rows(db) -> list[dict]:
    rids = list(DEMO_REQUEST_META.keys())
    rows = []
    for rid in rids:
        req = db.query(DbRequest).filter(DbRequest.request_id == rid).first()
        if not req:
            rows.append(
                {
                    "request_id": rid,
                    "request_status": "—",
                    "ppf_status": "—",
                    "wf_status": "—",
                    "ws_count": 0,
                    "purpose": DEMO_REQUEST_META.get(rid, ("", ""))[0],
                    "next_step": DEMO_REQUEST_META.get(rid, ("", ""))[1],
                }
            )
            continue
        wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).all()
        st_ppf = next((w.status for w in wss if w.workstream_type == "PPF_INSTALLATION"), "—")
        st_wf = next((w.status for w in wss if w.workstream_type == "WINDOW_FILM_INSTALLATION"), "—")
        purpose, nxt = DEMO_REQUEST_META.get(rid, ("", ""))
        rows.append(
            {
                "request_id": rid,
                "request_status": req.status or "—",
                "ppf_status": st_ppf or "—",
                "wf_status": st_wf or "—",
                "ws_count": len(wss),
                "purpose": purpose,
                "next_step": nxt,
            }
        )
    return rows


def _fmt_resolve_block(title: str, j: dict) -> list[str]:
    lines = [f"**{title}**"]
    if j.get("_crash"):
        lines.append(f"- **Lỗi (crash):** `{j.get('_error', '')}`")
        return lines
    http = j.get("_http")
    if http:
        lines.append(f"- HTTP `{http}` — không resolve được.")
        return lines
    found = j.get("found")
    lines.append(f"- `found`: **{found}**")
    if found:
        norm = j.get("norm") or {}
        lines.append(f"- `norm_id`: `{norm.get('norm_id', j.get('norm_id', '—'))}`")
        w = norm.get("windshield_size") or j.get("windshield_size")
        lines.append(f"- Kính lái (windshield_size): `{w}`")
        rw = norm.get("rear_window_size") or "—"
        lines.append(f"- Kính hậu: `{rw}`")
    else:
        lines.append("- API trả `found=false` — **không crash**.")
        lines.append("- Khi tạo đơn: hệ thống có thể đặt `request_status = NEEDS_REVIEW` và cảnh báo thiếu định mức ACTIVE (theo logic `vehicle_norm_logic` / `customer_api`).")
    return lines


def build_report() -> tuple[str, dict]:
    """
    1) Đọc DB (đếm + kiểm tra tĩnh) — phản ánh trạng thái sau seed, trước smoke.
    2) Chạy smoke subprocess (có thể thay đổi tồn kho / audit).
    """
    init_db()
    db = SessionLocal()
    try:
        counts = _counts(db)
        excel_an = analyze_excel_norm_workbook(str(CANONICAL_XLSX) if CANONICAL_XLSX.is_file() else None)
        if not excel_an.get("ok") and not excel_an.get("path"):
            excel_an = analyze_excel_norm_workbook(None)
        excel_db_n = _excel_norm_db_count(db)
        samples = _sample_norms(db, 10)
        ppf = _ppf_norm_row(db)
        note_obj = {}
        if ppf and ppf.note:
            try:
                note_obj = json.loads(ppf.note)
            except json.JSONDecodeError:
                note_obj = {}

        ppf_ok = bool(
            ppf
            and (ppf.status or "").upper() == "ACTIVE"
            and (ppf.windshield_size or "") == "152x1300"
            and abs(float(ppf.windshield_width_cm or 0) - 152.0) < 0.01
            and abs(float(ppf.windshield_length_cm or 0) - 1300.0) < 0.01
            and note_obj.get("item_code") == "FULL_VEHICLE_PPF"
            and note_obj.get("planned_size") == "152x1300"
            and abs(float(note_obj.get("required_length_m") or 0) - 13.0) < 0.01
        )

        mat_lines: list[str] = []
        mat_all_ok = True
        for ji, exp in (
            ("WINDSHIELD", "RT40"),
            ("REAR_WINDOW", "JB20"),
            ("FRONT_SIDE", "JB20"),
            ("REAR_SIDE_TRIANGLE", "JB20"),
            ("TRIANGLE", "JB20"),
            ("REAR_SIDE", "JB20"),
            ("SUNROOF", "JB20"),
        ):
            rowp = (
                db.query(DbMaterialPreference)
                .filter(
                    DbMaterialPreference.film_type == FT_WF,
                    DbMaterialPreference.job_item == ji,
                    DbMaterialPreference.preferred_material_code == exp,
                    DbMaterialPreference.status == "ACTIVE",
                )
                .first()
            )
            jr = _mat_resolve_db(db, FT_WF, ji)
            code = (jr.get("preferred_material_code") or "").upper()
            ok1 = bool(rowp)
            ok2 = bool(jr.get("found")) and code == exp
            mat_all_ok = mat_all_ok and ok1 and ok2
            mat_lines.append(
                f"| {ji} | `{exp}` | DB: `{'OK' if ok1 else 'FAIL'}` | resolve: `{'OK' if ok2 else 'FAIL'}` → `{code}` |"
            )
        row_ppfp_t = (
            db.query(DbMaterialPreference)
            .filter(
                DbMaterialPreference.film_type == FT_PPF,
                DbMaterialPreference.job_item == "PPF_BODY",
                DbMaterialPreference.preferred_material_code == "T-TYPE",
                DbMaterialPreference.priority == 1,
                DbMaterialPreference.status == "ACTIVE",
            )
            .first()
        )
        row_ppfp_m = (
            db.query(DbMaterialPreference)
            .filter(
                DbMaterialPreference.film_type == FT_PPF,
                DbMaterialPreference.job_item == "PPF_BODY",
                DbMaterialPreference.preferred_material_code == "M-TYPE",
                DbMaterialPreference.priority == 2,
                DbMaterialPreference.status == "ACTIVE",
            )
            .first()
        )
        jr_ppf = _mat_resolve_db(db, FT_PPF, "PPF_BODY")
        code_p = (jr_ppf.get("preferred_material_code") or "").upper()
        ok_ppf_res = bool(jr_ppf.get("found")) and code_p == "T-TYPE"
        mat_all_ok = mat_all_ok and bool(row_ppfp_t) and bool(row_ppfp_m) and ok_ppf_res
        mat_lines.append(
            f"| PPF_BODY (ưu tiên 1) | `T-TYPE` | DB: `{'OK' if row_ppfp_t else 'FAIL'}` | resolve: `{'OK' if ok_ppf_res else 'FAIL'}` → `{code_p}` |"
        )
        mat_lines.append(
            f"| PPF_BODY (ưu tiên 2) | `M-TYPE` | DB: `{'OK' if row_ppfp_m else 'FAIL'}` | (API resolve chỉ trả một mã ưu tiên cao nhất) |"
        )

        ocr_info = _ocr_checks(db)
        ocr_ok = all(
            v.get("exists")
            and v.get("review_status") == "NEEDS_REVIEW"
            and v.get("ocr_status") == "COMPLETED"
            and not v.get("created_request_id")
            and v.get("masked_payload")
            for v in ocr_info.values()
        )

        rx350_2026 = _resolve_case_db(db, "RX350", 2026, FT_WF)
        rx350_2023 = _resolve_case_db(db, "RX350", 2023, FT_WF)
        es250 = _resolve_case_db(db, "ES250", 2024, FT_WF)
        camry = _resolve_case_db(db, "CAMRY", 2025, FT_WF)

        demo_rows = _demo_request_rows(db)
    finally:
        db.close()

    integ_ok, integ_rc, integ_out = _subrun(
        "database_seed_integrity_smoke_test.py",
        "DATABASE SEED INTEGRITY SMOKE TEST PASSED",
    )
    ws_ok, ws_rc, _ = _subrun(
        "workstream_allocation_common_smoke_test.py",
        "WORKSTREAM ALLOCATION COMMON SMOKE TEST PASSED",
    )
    mp_ok, mp_rc, _ = _subrun(
        "material_preference_manual_order_smoke_test.py",
        "MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED",
    )
    inv_ok, inv_rc, _ = _subrun(
        "inventory_admin_smoke_test.py",
        "INVENTORY ADMIN SMOKE TEST PASSED",
    )
    mo_ok, mo_rc, _ = _subrun(
        "manual_order_customer_smoke_test.py",
        "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED",
    )
    loc_path = HERE / "static" / "location_master.json"
    loc_ok, loc_rc = True, 0
    loc_detail = "[skip] Không có `static/location_master.json`"
    if loc_path.is_file():
        loc_ok, loc_rc, _ = _subrun(
            "location_master_address_smoke_test.py",
            "LOCATION MASTER & ADDRESS BUILD SMOKE TEST PASSED",
        )
        loc_detail = f"rc={loc_rc}, PASS={loc_ok}"

    all_pass = (
        integ_ok
        and ws_ok
        and mp_ok
        and inv_ok
        and mo_ok
        and ppf_ok
        and mat_all_ok
        and ocr_ok
        and (loc_ok if loc_path.is_file() else True)
    )

    lines: list[str] = []
    lines.append("# Database Standard Seed Report")
    lines.append("")
    lines.append(f"- **Generated (UTC):** `{_utc_now_iso()}`")
    lines.append(f"- **Integrity smoke:** `{'PASS' if integ_ok else 'FAIL'}` (exit {integ_rc}) — chạy **sau** bước đếm DB; chi tiết mục 7.")
    lines.append(
        "- **Ghi chú:** Script **không** reset database. Bảng mục 1 / 2.1 đếm **trước** khi chạy smoke subprocess (smoke có thể thay đổi tồn kho). Nếu integrity FAIL: `python reset_database_full_seed.py` rồi chạy lại báo cáo."
    )
    lines.append("")

    lines.append("## 1. Seed Summary Counts")
    lines.append("")
    lines.append("| Nhóm | Số bản ghi |")
    lines.append("|------|------------:|")
    lines.append(f"| Dealers | {counts['dealers']} |")
    lines.append(f"| End Customers (bảng `customers`) | {counts['end_customers']} |")
    lines.append(f"| Vehicle Profiles | {counts['vehicle_profiles']} |")
    lines.append(f"| Vehicle Film Norms | {counts['vehicle_film_norms']} |")
    lines.append(f"| Material Preferences | {counts['material_preferences']} |")
    lines.append(f"| LOTs | {counts['lots']} |")
    lines.append(f"| OFFCUTs | {counts['offcuts']} |")
    lines.append(f"| OCR Drafts | {counts['ocr_drafts']} |")
    lines.append(f"| Requests | {counts['requests']} |")
    lines.append(f"| Workstreams | {counts['workstreams']} |")
    lines.append(f"| Job Cards | {counts['job_cards']} |")
    lines.append(f"| Inventory Transactions | {counts['inventory_transactions']} |")
    lines.append(f"| Audit Logs | {counts['audit_logs']} |")
    lines.append("")

    lines.append("## 2.1 Seed Summary Counts")
    lines.append("")
    lines.append("(Trùng mục 1 — giữ heading theo yêu cầu nghiệm thu.)")
    lines.append("")

    lines.append("## 2.2 Film Norm Import Result")
    lines.append("")
    lines.append(f"- **File nguồn (chuẩn báo cáo):** `{CANONICAL_XLSX}`")
    lines.append(f"- **File thực tế dùng phân tích:** `{excel_an.get('path', '—')}`")
    if excel_an.get("ok"):
        lines.append(f"- **Tổng dòng thân sheet (không gồm header):** {excel_an.get('total_body_rows', 0)}")
        lines.append(f"- **Dòng dữ liệu hợp lệ (sẽ import nếu chạy import):** {excel_an.get('valid_data_rows', 0)}")
        lines.append(f"- **Skip — dòng trống:** {excel_an.get('skipped_empty_rows', 0)}")
        lines.append(f"- **Skip — thiếu mã dòng xe:** {excel_an.get('skipped_missing_vehicle_code', 0)}")
        lines.append(f"- **Skip — Năm Model không hợp lệ / rỗng:** {excel_an.get('skipped_invalid_model_year', 0)}")
    else:
        lines.append(f"- **Phân tích Excel:** FAIL — `{excel_an.get('error', '')}`")
    lines.append(
        f"- **Số bản ghi trong DB gắn với import Excel (ước lượng):** `{excel_db_n}` (norm_id `NORM-XLS%` hoặc note chứa `Import Excel`)"
    )
    lines.append("")
    lines.append("### 10 dòng định mức mẫu (sau seed, ưu tiên bản ghi từ Excel)")
    lines.append("")
    lines.append(
        "| film_type | vehicle_model_code | model_year (range) | windshield | rear_window | front_side | rear_side_triangle | sunroof | status |"
    )
    lines.append("|-----------|-------------------|---------------------|--------------|---------------|------------|---------------------|---------|--------|")
    for s in samples:
        my = s.model_year_range or "—"
        lines.append(
            f"| {s.film_type} | {s.vehicle_model_code} | {my} | {s.windshield_size or ''} | {s.rear_window_size or ''} | {s.front_side_size or ''} | {s.rear_side_triangle_size or ''} | {s.sunroof_size or ''} | {s.status} |"
        )
    lines.append("")
    lines.append("### Resolve định mức (`vehicle_norm_logic.resolve_vehicle_norm_with_year_fallback`, tương đương GET `/api/vehicle-norms/resolve`)")
    lines.append("")
    for title, jj in (
        ("RX350 / 2026", rx350_2026),
        ("RX350 / 2023", rx350_2023),
        ("ES250 / 2024", es250),
        ("CAMRY / 2025", camry),
    ):
        lines.extend(_fmt_resolve_block(title, jj))
        lines.append("")
    lines.append("## 2.3 PPF Norm Result")
    lines.append("")
    if not ppf:
        lines.append("- **FAIL:** Không có bản ghi `NORM-PPF-ALL-ALL-DEFAULT`.")
    else:
        lines.append("- **Có định mức PPF Full xe (global):** Có (`norm_id=NORM-PPF-ALL-ALL-DEFAULT`).")
        lines.append(f"- **item_code (note JSON):** `{note_obj.get('item_code', '—')}`")
        lines.append(f"- **planned_size (note JSON):** `{note_obj.get('planned_size', '—')}`")
        lines.append(f"- **windshield_size (block PPF trên row):** `{ppf.windshield_size}` → width_cm={ppf.windshield_width_cm}, length_cm={ppf.windshield_length_cm}")
        lines.append(f"- **required_length_m (note JSON):** {note_obj.get('required_length_m', '—')}")
        lines.append(f"- **status:** `{ppf.status}`")
        lines.append(f"- **Kiểm tra tổng hợp (2.3):** `{'PASS' if ppf_ok else 'FAIL'}`")
    lines.append("")

    lines.append("## 2.4 Material Preference Result")
    lines.append("")
    lines.append("| job_item | Kỳ vọng | Kiểm tra |")
    lines.append("|:---|:---|:---|")
    lines.extend(mat_lines)
    lines.append("")
    lines.append(
        "- **Quy tắc nghiệm thu:** Mã vật tư WF/PPF phải khớp bảng `material_preferences` và hàm `resolve_material_preference` (cùng logic GET `/api/material-preferences/resolve`)."
    )
    lines.append(
        "- **Không hardcode RT40/JB20 trong luồng tạo đơn / OCR confirm / allocation:** logic tạo đơn và phân bổ dùng resolve & plan (xem `customer_api`, `wf_allocation_service`, `material_preference_logic`); smoke `material_preference_manual_order` và `workstream_allocation_common` xác nhận hành vi."
    )
    lines.append("")

    lines.append("## 2.5 OCR Draft Check")
    lines.append("")
    for did, info in ocr_info.items():
        lines.append(f"### `{did}`")
        if not info.get("exists"):
            lines.append("- **FAIL:** Không tồn tại trong DB.")
            continue
        lines.append("- **Tồn tại:** Có")
        lines.append(f"- **review_status:** `{info.get('review_status')}` (kỳ vọng NEEDS_REVIEW)")
        lines.append(f"- **ocr_status:** `{info.get('ocr_status')}` (kỳ vọng COMPLETED)")
        lines.append(
            f"- **Chưa tự tạo request:** `{'OK' if not info.get('created_request_id') else 'FAIL'}` (`created_request_id={info.get('created_request_id')!r}`)"
        )
        lines.append(f"- **Payload demo đầy đủ (không placeholder MASKED, VIN 17 ký tự):** `{'OK' if info.get('masked_payload') else 'FAIL'}`")
    lines.append("")
    lines.append(f"- **OCR draft checks tổng:** `{'PASS' if ocr_ok else 'FAIL'}`")
    lines.append("")

    lines.append("## 6. Demo Request Check")
    lines.append("")
    lines.append(
        "| Request ID | Request Status | #WS | PPF Status | Window Film Status | Purpose | Next Step |"
    )
    lines.append("|---|---:|---:|---|---|---|---|")
    for dr in demo_rows:
        lines.append(
            f"| {dr['request_id']} | {dr['request_status']} | {dr['ws_count']} | {dr['ppf_status']} | {dr['wf_status']} | {dr['purpose']} | {dr['next_step']} |"
        )
    lines.append("")

    lines.append("## 7. Smoke Test Detail")
    lines.append("")
    lines.append("| Script | Result | Exit |")
    lines.append("|--------|:------:|-----:|")
    lines.append(f"| database_seed_integrity_smoke_test.py | **{'PASS' if integ_ok else 'FAIL'}** | {integ_rc} |")
    lines.append(f"| workstream_allocation_common_smoke_test.py | **{'PASS' if ws_ok else 'FAIL'}** | {ws_rc} |")
    lines.append(f"| material_preference_manual_order_smoke_test.py | **{'PASS' if mp_ok else 'FAIL'}** | {mp_rc} |")
    lines.append(f"| inventory_admin_smoke_test.py | **{'PASS' if inv_ok else 'FAIL'}** | {inv_rc} |")
    lines.append(f"| manual_order_customer_smoke_test.py | **{'PASS' if mo_ok else 'FAIL'}** | {mo_rc} |")
    lines.append(f"| location_master_address_smoke_test.py (nếu có JSON) | **{'PASS' if loc_ok else 'FAIL'}** / {loc_detail} | {loc_rc if loc_path.is_file() else '—'} |")
    lines.append("")
    if not integ_ok:
        lines.append("<details><summary>Integrity output (tail)</summary>\n\n```text\n")
        lines.append(integ_out[-2500:].replace("\r\n", "\n"))
        lines.append("\n```\n</details>")
        lines.append("")

    lines.append("## 8. Final Conclusion")
    lines.append("")
    if all_pass:
        lines.append("**DATABASE STANDARD SEED READY FOR WEBSITE DEMO**")
    else:
        lines.append("**SEED / SMOKE CHƯA ĐẠT — KHÔNG ĐÁNH GIÁ READY.**")
        lines.append("")
        lines.append("Sửa lỗi smoke hoặc seed, chạy `python reset_database_full_seed.py` nếu cần, rồi chạy lại:")
        lines.append("")
        lines.append("```bash")
        lines.append("python database_seed_integrity_smoke_test.py")
        lines.append("python generate_database_standard_seed_report.py")
        lines.append("```")
    lines.append("")

    report_text = "\n".join(lines)
    meta = {
        "counts": counts,
        "integrity_pass": integ_ok,
        "all_pass": all_pass,
        "excel_an": excel_an,
        "excel_db_norms": excel_db_n,
    }
    return report_text, meta


def main() -> int:
    text, meta = build_report()
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(text, encoding="utf-8")
    print("1) Seed summary counts:", meta["counts"])
    print("2) Film norm — Excel OK:", meta["excel_an"].get("ok"), "valid rows:", meta["excel_an"].get("valid_data_rows"), "DB excel-like norms:", meta["excel_db_norms"])
    print("3) Material preference: xem mục 2.4 trong report")
    print("4) OCR draft: xem mục 2.5 trong report")
    print("5) Demo requests: xem mục 6 trong report")
    print("6) Smoke:", "integrity=", meta["integrity_pass"], "all_pass=", meta["all_pass"])
    print("7) Report path:", REPORT_PATH)
    return 0 if meta["all_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
