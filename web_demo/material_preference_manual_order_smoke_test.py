# -*- coding: utf-8 -*-
"""Smoke: Material preference APIs + manual order integration."""
import json
import sys
import uuid
from datetime import date

from fastapi.testclient import TestClient

from database import init_db, SessionLocal, DbMaterialPreference
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


def _subrun(script: str, expect_line: str) -> tuple:
    import subprocess
    import os

    d = os.path.dirname(__file__)
    p = subprocess.run([sys.executable, script], cwd=d, capture_output=True, text=True)
    ok = p.returncode == 0 and expect_line in (p.stdout or "")
    return ok, (p.stderr or p.stdout)[-400:]


def main():
    init_db()
    db = SessionLocal()
    try:
        from populate_db import _seed_material_preferences

        _seed_material_preferences(db)
        db.commit()
    finally:
        db.close()
    suffix = uuid.uuid4().hex[:8].upper()
    today = date.today().strftime("%Y%m%d")

    r1 = client.get("/api/material-preferences")
    add(1, "GET /api/material-preferences 200", r1.status_code == 200, r1.text[:80])

    r2 = client.get("/api/material-preferences", params={"job_item": "WINDSHIELD"})
    j2 = r2.json()
    has_rt40 = any(
        (x.get("preferred_material_code") or "").upper() == "RT40" and x.get("job_item") == "WINDSHIELD"
        for x in (j2.get("items") or [])
    )
    add(2, "GET ?job_item=WINDSHIELD có RT40 seed", r2.status_code == 200 and has_rt40, str(len(j2.get("items") or [])))

    r3 = client.get(
        "/api/material-preferences/resolve",
        params={"film_type": "Phim cách nhiệt", "job_item": "WINDSHIELD"},
    )
    j3 = r3.json()
    add(3, "resolve WINDSHIELD found", r3.status_code == 200 and j3.get("found") is True, str(j3)[:100])

    db = SessionLocal()
    try:
        row = (
            db.query(DbMaterialPreference)
            .filter(DbMaterialPreference.job_item == "WINDSHIELD", DbMaterialPreference.status == "ACTIVE")
            .filter(DbMaterialPreference.film_type == "Phim cách nhiệt")
            .order_by(DbMaterialPreference.priority)
            .first()
        )
        db_ok = row is not None and (row.preferred_material_code or "").upper() == j3.get("preferred_material_code", "").upper()
    finally:
        db.close()
    add(4, "resolve WINDSHIELD khớp DB (không hardcode trong assert)", db_ok, j3.get("preferred_material_code") or "")

    new_pid = f"MATPREF-SMOKE-{suffix}"
    r5 = client.post(
        "/api/material-preferences",
        json={
            "preference_id": new_pid,
            "film_type": "Phim cách nhiệt",
            "job_item": "SUNROOF",
            "preferred_material_code": f"RS-SMOKE-{suffix}",
            "material_name": "Smoke unique roll",
            "priority": 5,
            "status": "ACTIVE",
            "note": "smoke create",
            "created_by": "SMOKE",
        },
    )
    add(5, "POST tạo cấu hình mới", r5.status_code == 200, r5.text[:80])

    r6 = client.post(
        "/api/material-preferences",
        json={
            "preference_id": f"{new_pid}-DUP",
            "film_type": "Phim cách nhiệt",
            "job_item": "SUNROOF",
            "preferred_material_code": f"RS-SMOKE-{suffix}",
            "priority": 2,
            "status": "ACTIVE",
        },
    )
    add(6, "POST duplicate ACTIVE fail", r6.status_code == 409, r6.text[:120])

    r7 = client.put(
        f"/api/material-preferences/{new_pid}",
        json={"note": "no reason"},
    )
    add(7, "PUT thiếu reason fail", r7.status_code == 400, r7.text[:80])

    r8 = client.put(
        f"/api/material-preferences/{new_pid}",
        json={"note": "updated", "reason": "smoke update", "updated_by": "SMOKE"},
    )
    add(8, "PUT có reason OK", r8.status_code == 200, r8.text[:80])

    r9 = client.post(
        f"/api/material-preferences/{new_pid}/deactivate",
        json={"reason": "smoke off", "updated_by": "SMOKE"},
    )
    add(9, "deactivate có reason", r9.status_code == 200, r9.text[:80])

    r10 = client.post(
        f"/api/material-preferences/{new_pid}/activate",
        json={"reason": "smoke on", "updated_by": "SMOKE"},
    )
    add(10, "activate có reason", r10.status_code == 200, r10.text[:80])

    r11 = client.get("/api/vehicle-norms/resolve", params={"vehicle_model_code": "RX350", "model_year": 2022, "film_type": "Phim cách nhiệt"})
    j11 = r11.json()
    items11 = {x["job_item"]: x for x in (j11.get("auto_fill_items") or [])}
    ok11 = j11.get("found") and items11.get("WINDSHIELD", {}).get("size") == "90x152"
    add(11, "resolve RX350 2022 size lái", ok11, json.dumps(items11.get("WINDSHIELD", {}), ensure_ascii=False)[:120])

    srcs = {x.get("material_source") for x in (j11.get("auto_fill_items") or [])}
    ok12 = srcs.issubset({"MATERIAL_PREFERENCE", "MISSING_PREFERENCE"}) and len(srcs) > 0
    add(12, "resolve material_source hợp lệ", ok12, str(srcs))

    did = f"DEALER-SMOKE-MAT-{suffix}"
    client.post(
        "/api/dealers",
        json={
            "dealer_id": did,
            "dealer_name": "Smoke MAT dealer",
            "address": "ADDR",
            "created_by": "SMOKE",
        },
    )
    r13 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "model_year": 2022,
            "film_type": "Phim cách nhiệt",
            "requested_delivery_at": f"{today[:4]}-06-10T10:00:00+07:00",
            "service_selection": {
                "include_ppf": False,
                "include_window_film": True,
                "window_film_items": ["WINDSHIELD", "REAR_WINDOW"],
                "film_type": "Phim cách nhiệt",
            },
            "created_by": "SMOKE",
        },
    )
    j13 = r13.json() if r13.status_code == 200 else {}
    add(13, "manual-create WF", r13.status_code == 200, (j13.get("request_id") or "")[:40])

    rid = j13.get("request_id")
    wf_items_ok = False
    if rid:
        wss = client.get(f"/api/requests/{rid}/workstreams").json()
        wf = next((w for w in wss if w.get("workstream_type") == "WINDOW_FILM_INSTALLATION"), None)
        if wf and wf.get("material_plan"):
            try:
                plan = json.loads(wf["material_plan"]) if isinstance(wf["material_plan"], str) else wf["material_plan"]
            except json.JSONDecodeError:
                plan = []
            by_ji = {p.get("job_item"): p for p in plan}
            wf_items_ok = (
                by_ji.get("WINDSHIELD", {}).get("material_code") == "RT40"
                and by_ji.get("REAR_WINDOW", {}).get("material_code") == "JB20"
            )
    add(14, "WF plan material theo preference", wf_items_ok, rid or "")

    r15 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "model_year": 2022,
            "film_type": "Phim cách nhiệt",
            "requested_delivery_at": f"{today[:4]}-06-11T10:00:00+07:00",
            "service_selection": {
                "include_ppf": False,
                "include_window_film": True,
                "window_film_items": [
                    {
                        "job_item": "WINDSHIELD",
                        "material_code": "JB20",
                        "width_cm": 90,
                        "length_cm": 152,
                        "size": "90x152",
                        "material_source": "MATERIAL_PREFERENCE",
                    }
                ],
            },
            "created_by": "SMOKE",
        },
    )
    add(15, "override material thiếu reason fail", r15.status_code == 400, r15.text[:120])

    r16 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "vehicle_model": "LEXUS_RX350",
            "film_type": "Phim cách nhiệt",
            "requested_delivery_at": f"{today[:4]}-06-12T10:00:00+07:00",
            "service_selection": {"include_ppf": False, "include_window_film": False},
            "created_by": "SMOKE",
        },
    )
    add(16, "không chọn dịch vụ fail", r16.status_code == 400, r16.text[:80])

    ok17, det17 = _subrun("manual_order_customer_smoke_test.py", "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED")
    add(17, "manual_order_customer_smoke_test.py", ok17, det17[-120:])

    ok18, det18 = _subrun("customer_filters_address_norm_smoke_test.py", "CUSTOMER FILTERS ADDRESS & NORM UI SMOKE TEST PASSED")
    add(18, "customer_filters_address_norm_smoke_test.py", ok18, det18[-120:])

    ok19, det19 = _subrun("inventory_admin_smoke_test.py", "INVENTORY ADMIN SMOKE TEST PASSED")
    add(19, "inventory_admin_smoke_test.py", ok19, det19[-120:])

    _print_table()
    failed = [x for x in ROWS if not x[2]]
    if failed:
        for n, name, _, det in failed:
            print(f"FAIL #{n} {name}: {det}")
        sys.exit(1)
    print("MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
