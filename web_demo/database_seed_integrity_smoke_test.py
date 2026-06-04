# -*- coding: utf-8 -*-
"""
Kiểm tra tích hợp sau reset + seed chuẩn.
Chạy từ web_demo (sau reset):  python database_seed_integrity_smoke_test.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

HERE = Path(__file__).resolve().parent
os.chdir(str(HERE))
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from database import init_db  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
FAIL = []


def ok(cond: bool, msg: str) -> None:
    if not cond:
        FAIL.append(msg)


def _items(resp) -> list:
    j = resp.json()
    if isinstance(j, list):
        return j
    return j.get("items") or []


def _subrun(script: str) -> tuple:
    p = subprocess.run(
        [sys.executable, script],
        cwd=str(HERE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (p.stdout or "") + "\n" + (p.stderr or "")
    return p.returncode, out


def main() -> int:
    init_db()
    # 1
    r = client.get("/api/dashboard")
    ok(r.status_code == 200, f"dashboard HTTP {r.status_code}")
    # 2
    dealers = _items(client.get("/api/dealers"))
    ok(any((d.get("dealer_id") == "DEALER_LEXUS_SG") for d in dealers), "DEALER_LEXUS_SG missing")
    # 3
    cust = _items(client.get("/api/end-customers"))
    ok(any("MASKED" in str(c.get("customer_masked") or "") for c in cust), "masked customer")
    # 4
    veh = _items(client.get("/api/vehicles"))
    ok(any((v.get("vehicle_model_code") or "").upper() == "RX350" for v in veh), "RX350 vehicle")
    # 5
    r5 = client.get(
        "/api/vehicle-norms/resolve",
        params={"vehicle_model_code": "RX350", "model_year": 2026, "film_type": "Phim cách nhiệt"},
    )
    j5 = r5.json() if r5.status_code == 200 else {}
    ok(r5.status_code == 200 and j5.get("found") is True, f"norm resolve RX350 2026 {r5.status_code} {j5}")
    # 6–7
    r6 = client.get("/api/material-preferences/resolve", params={"film_type": "Phim cách nhiệt", "job_item": "WINDSHIELD"})
    j6 = r6.json() if r6.status_code == 200 else {}
    ok(j6.get("found") and (j6.get("preferred_material_code") or "").upper() == "RT40", f"matpref WINDSHIELD {j6}")
    r7 = client.get("/api/material-preferences/resolve", params={"film_type": "Phim cách nhiệt", "job_item": "REAR_WINDOW"})
    j7 = r7.json() if r7.status_code == 200 else {}
    ok(j7.get("found") and (j7.get("preferred_material_code") or "").upper() == "JB20", f"matpref REAR_WINDOW {j7}")
    # 8
    r8 = client.get("/api/inventory/lots/active-options", params={"material_code": "JB20"})
    bad_lot = {"LOT-DEMO-CLEARED-001", "LOT-DEMO-DEPLETED-001", "LOT-DEMO-LOCKED-001"}
    ids8 = {x.get("source_id") for x in (r8.json().get("items") or [])}
    ok(not (ids8 & bad_lot), f"active-options JB20 should exclude demo terminal {ids8 & bad_lot}")
    # 9
    r9 = client.get("/api/inventory/offcuts/active-options", params={"material_code": "JB20"})
    ids9 = {x.get("source_id") for x in (r9.json().get("items") or [])}
    ok("SUBLOT-DEMO-QUALITY-FAILED" not in ids9 and "SUBLOT-DEMO-USED" not in ids9, f"offcut active-options {ids9}")
    # 10–11
    ocr = client.get("/api/ocr-drafts").json()
    if not isinstance(ocr, list):
        ocr = ocr.get("items") or []
    ids_ocr = {x.get("ocr_draft_id") for x in ocr}
    ok("OCR-DRAFT-LEXUS-115-NEW" in ids_ocr, "OCR 115")
    ok("OCR-DRAFT-LEXUS-117-NEW" in ids_ocr, "OCR 117")
    # 12
    reqs = client.get("/api/requests").json()
    rids = {x.get("request_id") for x in reqs}
    ok("REQ-DEMO-PENDING-PPF-WF" in rids, "REQ-DEMO-PENDING-PPF-WF")
    # 13–15
    wss = client.get("/api/requests/REQ-DEMO-PENDING-PPF-WF/workstreams").json()
    ok(isinstance(wss, list) and len(wss) >= 2, f"workstreams count {wss}")
    ppf = next((w for w in wss if w.get("workstream_type") == "PPF_INSTALLATION"), {})
    wf = next((w for w in wss if w.get("workstream_type") == "WINDOW_FILM_INSTALLATION"), {})
    pjson = ppf.get("ppf_allocation") or ppf.get("ppf_allocation_json")
    if isinstance(pjson, str):
        try:
            pjson = json.loads(pjson)
        except json.JSONDecodeError:
            pjson = {}
    items_p = pjson.get("items") or []
    full = next((i for i in items_p if i.get("item_code") == "FULL_VEHICLE_PPF"), {})
    srcs = full.get("sources") or []
    ok(abs(float(full.get("required_length_m") or 0) - 13.0) < 0.01 and len(srcs) >= 2, f"PPF full 13m 2 sources {full}")
    wjson = wf.get("wf_allocation") or wf.get("wf_allocation_json")
    if isinstance(wjson, str):
        try:
            wjson = json.loads(wjson)
        except json.JSONDecodeError:
            wjson = {}
    witems = {i.get("item_code"): i for i in (wjson.get("items") or [])}
    ws = witems.get("WINDSHIELD") or {}
    ok((ws.get("material_code") or "").upper() == "RT40", f"WF WINDSHIELD RT40 {ws}")
    # 16
    jobs = client.get("/api/job-cards").json()
    if not isinstance(jobs, list):
        jobs = jobs.get("items") or []
    inj = [j for j in jobs if j.get("request_id") == "REQ-DEMO-IN-PROGRESS" and j.get("status") == "IN_PROGRESS"]
    ok(any(j.get("started_at") for j in inj), "IN_PROGRESS job started")
    # 17
    wsp = client.get("/api/requests/REQ-DEMO-PARTIAL/workstreams").json()
    stp = {w.get("workstream_type"): w.get("status") for w in wsp}
    ok(stp.get("PPF_INSTALLATION") == "CLOSED" and stp.get("WINDOW_FILM_INSTALLATION") == "IN_PROGRESS", f"partial ws {stp}")
    # 18
    inv = client.get("/api/inventory/transactions", params={"related_request_id": "REQ-DEMO-CLOSED"}).json()
    inv_items = inv if isinstance(inv, list) else inv.get("items") or []
    ttypes = {x.get("transaction_type") for x in inv_items}
    ok("ISSUE_FROM_LOT" in ttypes or len(inv_items) > 0, f"closed inventory txns {ttypes}")
    # 19
    logs = client.get("/api/audit-logs").json()
    if not isinstance(logs, list):
        logs = logs.get("items") or []
    lev = {x.get("transaction_type") for x in logs}
    ok("DATABASE_RESET_SEEDED" in lev, "audit DATABASE_RESET_SEEDED")
    # Giải phóng pool SQLite trước subprocess (Windows: tránh validate-sources lệch / lock).
    try:
        from sqlalchemy.orm import close_all_sessions

        from database import engine

        close_all_sessions()
        engine.dispose()
    except Exception:
        pass
    # 20–23 subprocess smokes
    scripts_expect = [
        ("workstream_allocation_common_smoke_test.py", "WORKSTREAM ALLOCATION COMMON SMOKE TEST PASSED"),
        ("material_preference_manual_order_smoke_test.py", "MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED"),
        ("inventory_admin_smoke_test.py", "INVENTORY ADMIN SMOKE TEST PASSED"),
        ("manual_order_customer_smoke_test.py", "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED"),
    ]
    for scr, needle in scripts_expect:
        code, out = _subrun(scr)
        ok(code == 0 and needle in out, f"{scr} rc={code} tail={out[-400:]!r}")
    # 24 location master optional
    lm = HERE / "static" / "location_master.json"
    if lm.is_file():
        code, out = _subrun("location_master_address_smoke_test.py")
        ok(code == 0 and "LOCATION MASTER & ADDRESS BUILD SMOKE TEST PASSED" in out, f"location_master_address_smoke_test rc={code}")
    else:
        print("[skip] location_master.json không có — bỏ qua location_master_address_smoke_test")

    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print(" -", f)
        return 1
    print("DATABASE SEED INTEGRITY SMOKE TEST PASSED")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
