# -*- coding: utf-8 -*-
"""
Smoke: Manual order + Customer management APIs.
Run from repo:  python manual_order_customer_smoke_test.py
"""
import json
import sys
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import text

from database import init_db, SessionLocal
from main import app

client = TestClient(app)
ROWS = []


def add(n, name, ok, detail=""):
    ROWS.append((n, name, ok, detail))


def _print_table():
    print("")
    print("| # | Case | Result | Detail |")
    print("|---:|---|:---:|---|")
    for n, name, ok, detail in ROWS:
        r = "PASS" if ok else "FAIL"
        d = (detail or "").replace("|", "\\|")[:120]
        print(f"| {n} | {name} | **{r}** | {d} |")
    print("")


def main():
    init_db()
    today = date.today().strftime("%Y%m%d")
    suffix = __import__("uuid").uuid4().hex[:8].upper()

    # 1
    r1 = client.get("/api/dealers")
    ok1 = r1.status_code == 200 and isinstance(r1.json(), list)
    add(1, "GET /api/dealers", ok1, "" if ok1 else r1.text[:200])

    # 2
    did = f"DEALER-SMOKE-{suffix}"
    r2 = client.post(
        "/api/dealers",
        json={
            "dealer_id": did,
            "dealer_name": "Đại lý smoke test",
            "legal_name": "Cty Smoke",
            "dealer_group": "SMOKE",
            "address": "120 Nguyễn Huệ, Quận 1, TP.HCM",
            "phone_masked": "0903123456",
            "created_by": "SMOKE",
            "note": "smoke",
        },
    )
    ok2 = r2.status_code == 200
    add(2, "POST /api/dealers mới", ok2, "" if ok2 else r2.text[:200])

    # 3
    r3 = client.post("/api/dealers", json={"dealer_id": did, "dealer_name": "Dup"})
    ok3 = r3.status_code == 409 or r3.status_code == 400
    add(3, "POST /api/dealers trùng dealer_id fail", ok3, r3.text[:120])

    # 4
    r4 = client.get("/api/end-customers")
    ok4 = r4.status_code == 200 and isinstance(r4.json(), list)
    add(4, "GET /api/end-customers", ok4, "" if ok4 else r4.text[:200])

    # 5
    cid = f"CUS-SMOKE-{suffix}"
    r5 = client.post(
        "/api/end-customers",
        json={
            "customer_id": cid,
            "customer_masked": "KH_SMOKE_MASK",
            "phone_masked": "P_MASK",
            "address_masked": "A_MASK",
            "customer_type": "END_CUSTOMER",
            "source_channel": "MANUAL",
            "created_by": "SMOKE",
        },
    )
    ok5 = r5.status_code == 200
    add(5, "POST /api/end-customers", ok5, "" if ok5 else r5.text[:200])

    # 6
    r6 = client.get("/api/vehicles")
    ok6 = r6.status_code == 200 and isinstance(r6.json(), list)
    add(6, "GET /api/vehicles", ok6, "" if ok6 else r6.text[:200])

    # 7
    vid = f"VEH-SMOKE-{suffix}"
    r7 = client.post(
        "/api/vehicles",
        json={
            "vehicle_id": vid,
            "customer_id": cid,
            "dealer_id": did,
            "vehicle_model_code": "LEXUS_RX350",
            "model_name": "Lexus RX350",
            "vin_masked": f"VIN_MASK_{suffix}",
            "created_by": "SMOKE",
        },
    )
    ok7 = r7.status_code == 200
    add(7, "POST /api/vehicles", ok7, "" if ok7 else r7.text[:200])

    # 8 PPF only
    r8 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "customer_id": cid,
            "vehicle_id": vid,
            "vehicle_model": "LEXUS_RX350",
            "requested_delivery_at": "2026-06-04T17:30:00+07:00",
            "service_selection": {"include_ppf": True, "ppf_type": "T-TYPE", "include_window_film": False},
            "created_by": "SMOKE",
        },
    )
    j8 = r8.json() if r8.headers.get("content-type", "").startswith("application/json") else {}
    ok8 = r8.status_code == 200 and "PPF_INSTALLATION" in (j8.get("created_workstreams") or [])
    rid8 = j8.get("request_id")
    add(8, "manual-create chỉ PPF", ok8, "" if ok8 else r8.text[:200])

    # 9 WF only
    r9 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "requested_delivery_at": "2026-06-04T18:00:00+07:00",
            "service_selection": {
                "include_ppf": False,
                "include_window_film": True,
                "window_film_items": ["WINDSHIELD", "REAR_WINDOW"],
            },
            "created_by": "SMOKE",
        },
    )
    j9 = r9.json() if r9.status_code == 200 else {}
    ok9 = r9.status_code == 200 and "WINDOW_FILM_INSTALLATION" in (j9.get("created_workstreams") or [])
    add(9, "manual-create chỉ WF", ok9, "" if ok9 else r9.text[:200])

    # 10 both
    r10 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "requested_delivery_at": "2026-06-04T19:00:00+07:00",
            "service_selection": {
                "include_ppf": True,
                "ppf_type": "M-TYPE",
                "include_window_film": True,
                "window_film_items": ["WINDSHIELD"],
            },
            "created_by": "SMOKE",
        },
    )
    j10 = r10.json() if r10.status_code == 200 else {}
    ws10 = j10.get("created_workstreams") or []
    ok10 = r10.status_code == 200 and "PPF_INSTALLATION" in ws10 and "WINDOW_FILM_INSTALLATION" in ws10
    add(10, "manual-create PPF+WF", ok10, "" if ok10 else r10.text[:200])

    # 11 no service
    r11 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "requested_delivery_at": "2026-06-04T20:00:00+07:00",
            "service_selection": {"include_ppf": False, "include_window_film": False},
        },
    )
    ok11 = r11.status_code == 400
    add(11, "manual-create không service fail", ok11, "")

    # 12 PPF no type
    r12 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "requested_delivery_at": "2026-06-04T21:00:00+07:00",
            "service_selection": {"include_ppf": True, "include_window_film": False},
        },
    )
    ok12 = r12.status_code == 400
    add(12, "manual-create PPF thiếu ppf_type fail", ok12, "")

    # 13–15 use rid8
    db = SessionLocal()
    try:
        if rid8:
            wss = db.execute(
                text("SELECT workstream_type, status FROM workstreams WHERE request_id = :rid"),
                {"rid": rid8},
            ).mappings().all()
            types = [row["workstream_type"] for row in wss]
            ok13 = "PPF_INSTALLATION" in types and len(types) >= 1
            add(13, "Manual request có workstream đúng", ok13, str(types))
            appr = not any(row["status"] == "APPROVED" for row in wss)
            add(14, "Manual không tự approve WS", appr, "")
        else:
            add(13, "Manual request có workstream đúng", False, "no rid8")
            add(14, "Manual không tự approve WS", False, "no rid8")

        logs = (
            db.execute(
                text(
                    "SELECT 1 FROM audit_logs WHERE request_id = :rid AND transaction_type = 'REQUEST_MANUAL_CREATED' LIMIT 1"
                ),
                {"rid": rid8},
            ).fetchone()
            if rid8
            else None
        )
        add(15, "Audit REQUEST_MANUAL_CREATED", bool(logs), "")
    finally:
        db.close()

    # 16–17 audits (best-effort)
    db = SessionLocal()
    try:
        c_ok = bool(
            db.execute(
                text("SELECT 1 FROM audit_logs WHERE transaction_type = 'CUSTOMER_CREATED' AND source_id = :cid LIMIT 1"),
                {"cid": cid},
            ).fetchone()
        )
        add(16, "Audit CUSTOMER_CREATED (smoke)", c_ok, "")
        v_ok = bool(
            db.execute(
                text("SELECT 1 FROM audit_logs WHERE transaction_type = 'VEHICLE_CREATED' AND source_id = :vid LIMIT 1"),
                {"vid": vid},
            ).fetchone()
        )
        add(17, "Audit VEHICLE_CREATED (smoke)", v_ok, "")
    finally:
        db.close()

    r18a = client.get("/api/ocr-drafts")
    ok18 = r18a.status_code == 200
    add(18, "GET /api/ocr-drafts (OCR API hiện tại)", ok18, "" if ok18 else r18a.text[:120])

    r19 = client.get("/api/inventory/summary")
    ok19 = r19.status_code == 200
    add(19, "GET /api/inventory/summary", ok19, "" if ok19 else r19.text[:120])

    r20 = client.get("/api/inventory/validate-sources/REQ-20260604-001")
    j20 = r20.json() if r20.status_code == 200 else {}
    errs = [i for i in (j20.get("issues") or []) if i.get("severity") == "ERROR"]
    ok20 = r20.status_code == 200 and len(errs) == 0
    add(20, "validate-sources REQ-20260604-001 không ERROR", ok20, str(errs)[:200])

    _print_table()
    failed = [x for x in ROWS if not x[2]]
    if failed:
        print("MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST FAILED")
        print("Failed:", [f[0] for f in failed])
        sys.exit(1)
    print("MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
