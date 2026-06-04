# -*- coding: utf-8 -*-
"""Smoke: AMIS dealer/customer APIs + vehicle film norms + manual-create norm."""
import json
import sys
import uuid

from fastapi.testclient import TestClient

from database import SessionLocal, init_db
from main import app
from populate_db import _seed_amis_and_vehicle_norms

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
    db = SessionLocal()
    try:
        _seed_amis_and_vehicle_norms(db)
        db.commit()
    finally:
        db.close()

    sfx = uuid.uuid4().hex[:8].upper()

    # 1
    r1 = client.get("/api/dealers")
    j1 = r1.json()
    ok1 = r1.status_code == 200 and isinstance(j1, list) and len(j1) > 0
    d0 = j1[0] if ok1 else {}
    ok1b = "customer_category" in d0 and "full_address" in d0
    add(1, "GET /api/dealers có field AMIS/address", ok1 and ok1b, "" if ok1 else r1.text[:200])

    # 2
    did = f"DEALER-AMIS-{sfx}"
    r2 = client.post(
        "/api/dealers",
        json={
            "dealer_id": did,
            "dealer_name": "Cty AMIS Smoke",
            "tax_code": f"TAX-{sfx}",
            "phone": "0909000001",
            "address_no": "10",
            "street": "Lý Tự Trọng",
            "ward": "P.Bến Nghé",
            "city": "TP.HCM",
            "amis_customer_code": f"KH{sfx[:6]}",
            "created_by": "SMOKE",
        },
    )
    add(2, "POST dealer full AMIS", r2.status_code == 200, r2.text[:160])

    # 3
    r3 = client.put(
        f"/api/dealers/{did}",
        json={"dealer_name": "Cty AMIS Smoke Sửa", "reason": "đổi tên demo", "updated_by": "SMOKE"},
    )
    add(3, "PUT dealer cần reason", r3.status_code == 200, r3.text[:120])

    # 4–5
    r4 = client.post(f"/api/dealers/{did}/deactivate", json={"reason": "ngừng hợp tác demo", "updated_by": "SMOKE"})
    add(4, "POST dealer deactivate", r4.status_code == 200, r4.text[:120])
    r5 = client.post(f"/api/dealers/{did}/activate", json={"reason": "mở lại demo", "updated_by": "SMOKE"})
    add(5, "POST dealer activate", r5.status_code == 200, r5.text[:120])

    # 6
    r6 = client.get("/api/end-customers")
    j6 = r6.json()
    ok6 = r6.status_code == 200 and isinstance(j6, list) and len(j6) > 0
    c0 = j6[0] if ok6 else {}
    add(6, "GET end-customers AMIS fields", ok6 and "customer_category" in c0, "")

    # 7–10
    cid = f"CUS-AMIS-{sfx}"
    r7 = client.post(
        "/api/end-customers",
        json={
            "customer_id": cid,
            "customer_name": "KH AMIS Smoke",
            "customer_masked": "KH AMIS Smoke",
            "tax_code": "",
            "phone": "0909111222",
            "address_no": "2A",
            "street": "Nguyễn Huệ",
            "ward": "Bến Nghé",
            "city": "TP.HCM",
            "amis_customer_code": "",
            "source_channel": "MANUAL",
            "created_by": "SMOKE",
        },
    )
    add(7, "POST end-customer full fields", r7.status_code == 200, r7.text[:160])
    r8 = client.put(
        f"/api/end-customers/{cid}",
        json={"customer_name": "KH AMIS Smoke 2", "reason": "sửa tên", "updated_by": "SMOKE"},
    )
    add(8, "PUT customer cần reason", r8.status_code == 200, r8.text[:120])
    r9 = client.post(f"/api/end-customers/{cid}/deactivate", json={"reason": "inactive demo", "updated_by": "SMOKE"})
    add(9, "POST customer deactivate", r9.status_code == 200, r9.text[:120])
    r10 = client.post(f"/api/end-customers/{cid}/activate", json={"reason": "active lại", "updated_by": "SMOKE"})
    add(10, "POST customer activate", r10.status_code == 200, r10.text[:120])

    # 11
    r11 = client.get("/api/vehicle-norms")
    j11 = r11.json()
    codes = {x.get("vehicle_model_code") for x in j11} if isinstance(j11, list) else set()
    add(11, "GET vehicle-norms có RX300/RX350", "RX300" in codes and "RX350" in codes, str(codes)[:120])

    # 12–13
    nid = f"NORM-SMOKE-{sfx}"
    r12 = client.post(
        "/api/vehicle-norms",
        json={
            "norm_id": nid,
            "film_type": "Phim cách nhiệt",
            "vehicle_model_code": f"SMOKE{sfx[:4]}",
            "model_year_range": "2020 - 2025",
            "windshield_size": "80x140",
            "rear_window_size": "50x100",
            "front_side_size": "70x110",
            "rear_side_triangle_size": "40x120",
            "created_by": "SMOKE",
        },
    )
    add(12, "POST vehicle-norms mới", r12.status_code == 200, r12.text[:160])
    r13 = client.post(
        "/api/vehicle-norms",
        json={
            "norm_id": nid + "B",
            "film_type": "Phim cách nhiệt",
            "vehicle_model_code": f"SMOKE{sfx[:4]}",
            "model_year_range": "2020 - 2025",
            "windshield_size": "80x140",
            "created_by": "SMOKE",
        },
    )
    add(13, "POST trùng ACTIVE fail", r13.status_code == 409, r13.text[:120])

    # 14–16
    r14 = client.put(
        f"/api/vehicle-norms/{nid}",
        json={"windshield_size": "81x141", "reason": "chỉnh size", "updated_by": "SMOKE"},
    )
    add(14, "PUT norm reason bắt buộc", r14.status_code == 200, r14.text[:120])
    r15 = client.post(f"/api/vehicle-norms/{nid}/deactivate", json={"reason": "off", "updated_by": "SMOKE"})
    add(15, "deactivate norm", r15.status_code == 200, r15.text[:120])
    r16 = client.post(f"/api/vehicle-norms/{nid}/activate", json={"reason": "on", "updated_by": "SMOKE"})
    add(16, "activate norm", r16.status_code == 200, r16.text[:120])

    # 17–18
    r17 = client.get("/api/vehicle-norms/resolve", params={"vehicle_model_code": "RX350", "model_year": 2022, "film_type": "Phim cách nhiệt"})
    j17 = r17.json()
    add(17, "resolve RX350 2022 found", r17.status_code == 200 and j17.get("found") is True, str(j17)[:120])
    items = {x["job_item"]: x for x in (j17.get("auto_fill_items") or [])}
    ok18 = (
        items.get("WINDSHIELD", {}).get("material_code") == "RT40"
        and items.get("WINDSHIELD", {}).get("size") == "90x152"
        and items.get("REAR_WINDOW", {}).get("material_code") == "JB20"
        and items.get("FRONT_SIDE", {}).get("size") == "92x130"
        and items.get("REAR_SIDE_TRIANGLE", {}).get("size") == "50x152"
    )
    add(18, "resolve auto-fill RT40/JB20 sizes", ok18, json.dumps(items, ensure_ascii=False)[:160])

    # 19
    r19 = client.post(
        "/api/requests/manual-create",
        json={
            "dealer_id": did,
            "customer_id": cid,
            "vehicle_model": "LEXUS_RX350",
            "model_year": 2022,
            "film_type": "Phim cách nhiệt",
            "requested_delivery_at": "2026-06-10T10:00:00+07:00",
            "service_selection": {
                "include_ppf": False,
                "include_window_film": True,
                "window_film_items": ["WINDSHIELD", "REAR_WINDOW", "FRONT_SIDE", "REAR_SIDE_TRIANGLE"],
            },
            "created_by": "SMOKE",
        },
    )
    ok19 = r19.status_code == 200
    j19 = r19.json() if ok19 else {}
    add(19, "manual-create WF dùng norm", ok19, (j19.get("request_id") or "")[:80])

    # 20 manual_order_customer_smoke_test subprocess
    import subprocess
    p = subprocess.run(
        [sys.executable, "manual_order_customer_smoke_test.py"],
        cwd=__import__("os").path.dirname(__file__),
        capture_output=True,
        text=True,
    )
    ok20 = p.returncode == 0 and "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED" in (p.stdout or "")
    add(20, "manual_order_customer_smoke_test.py", ok20, (p.stderr or p.stdout)[-200:])

    _print_table()
    failed = [x for x in ROWS if not x[2]]
    if failed:
        for n, name, _, det in failed:
            print(f"FAIL #{n} {name}: {det}")
        print("CUSTOMER AMIS & VEHICLE NORM SMOKE TEST FAILED")
        sys.exit(1)
    print("CUSTOMER AMIS & VEHICLE NORM SMOKE TEST PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
