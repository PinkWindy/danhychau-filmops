# -*- coding: utf-8 -*-
"""
Smoke: PUT dealer/customer địa chỉ + reason; activate/deactivate; vehicle-norms PUT/resolve.
Chạy: python customer_address_norm_ui_smoke_test.py
"""
import json
import subprocess
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


def _print_frontend_checklist():
    print("")
    print("--- Frontend manual checklist (UI) ---")
    for line in (
        "[ ] Nút Sửa định mức (data-norm-id + delegation) mở modal",
        "[ ] Modal Sửa định mức: đủ field + Lưu + PUT + toast",
        "[ ] Modal đại lý/KH: nút X, Hủy — confirm khi dirty; ESC đóng",
        "[ ] TP đổi → gợi ý Phường (datalist); Phường gõ tay được",
        "[ ] Địa chỉ đầy đủ auto + nút Tự tạo lại",
        "[ ] Active/Inactive: modal lý do (không dùng prompt)",
    ):
        print(line)
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
    did = f"DEALER-ADDR-{sfx}"
    cid = f"CUS-ADDR-{sfx}"

    r_post_d = client.post(
        "/api/dealers",
        json={
            "dealer_id": did,
            "dealer_name": "Smoke Addr Dealer",
            "tax_code": f"TAXA{sfx[:4]}",
            "phone": "0909111222",
            "address_no": "Số 1",
            "street": "Trần Hưng Đạo",
            "ward": "Cầu Ông Lãnh",
            "city": "Thành phố Hồ Chí Minh",
            "amis_customer_code": f"A{sfx[:5]}",
            "created_by": "SMOKE",
        },
    )
    add(1, "POST dealer (địa chỉ thành phần)", r_post_d.status_code == 200, r_post_d.text[:100])

    r_put_d = client.put(
        f"/api/dealers/{did}",
        json={
            "reason": "cập nhật địa chỉ smoke",
            "updated_by": "SMOKE",
            "address_no": "Số 264",
            "street": "Trần Hưng Đạo",
            "ward": "Cầu Ông Lãnh",
            "city": "Thành phố Hồ Chí Minh",
            "full_address": "Số 264, Đường Trần Hưng Đạo, Phường Cầu Ông Lãnh, Thành phố Hồ Chí Minh",
        },
    )
    add(2, "PUT dealer địa chỉ + reason", r_put_d.status_code == 200, r_put_d.text[:100])

    r_put_d_fail = client.put(
        f"/api/dealers/{did}",
        json={"dealer_name": "No reason", "updated_by": "SMOKE"},
    )
    add(3, "PUT dealer thiếu reason → 400", r_put_d_fail.status_code == 400, r_put_d_fail.text[:80])

    r_post_c = client.post(
        "/api/end-customers",
        json={
            "customer_id": cid,
            "customer_masked": "KH smoke",
            "customer_name": "KH Smoke Addr",
            "phone": "0909333444",
            "address_no": "19 Tôn Đức Thắng",
            "street": "",
            "ward": "Quận 1",
            "city": "TP. HCM",
            "amis_customer_code": f"C{sfx[:5]}",
            "created_by": "SMOKE",
        },
    )
    add(4, "POST end-customer địa chỉ", r_post_c.status_code == 200, r_post_c.text[:100])

    r_put_c = client.put(
        f"/api/end-customers/{cid}",
        json={
            "reason": "sửa địa chỉ smoke",
            "updated_by": "SMOKE",
            "address_no": "20 Lê Lợi",
            "street": "Lê Lợi",
            "ward": "Phường Bến Nghé",
            "city": "Thành phố Hồ Chí Minh",
        },
    )
    add(5, "PUT customer địa chỉ + reason", r_put_c.status_code == 200, r_put_c.text[:100])

    r_put_c_fail = client.put(
        f"/api/end-customers/{cid}",
        json={"customer_name": "No reason", "updated_by": "SMOKE"},
    )
    add(6, "PUT customer thiếu reason → 400", r_put_c_fail.status_code == 400, r_put_c_fail.text[:80])

    r_dd = client.post(f"/api/dealers/{did}/deactivate", json={"reason": "off demo", "updated_by": "SMOKE"})
    add(7, "POST dealer deactivate + reason", r_dd.status_code == 200, r_dd.text[:80])
    r_da = client.post(f"/api/dealers/{did}/activate", json={"reason": "on demo", "updated_by": "SMOKE"})
    add(8, "POST dealer activate + reason", r_da.status_code == 200, r_da.text[:80])

    r_cd = client.post(f"/api/end-customers/{cid}/deactivate", json={"reason": "off demo", "updated_by": "SMOKE"})
    add(9, "POST customer deactivate + reason", r_cd.status_code == 200, r_cd.text[:80])
    r_ca = client.post(f"/api/end-customers/{cid}/activate", json={"reason": "on demo", "updated_by": "SMOKE"})
    add(10, "POST customer activate + reason", r_ca.status_code == 200, r_ca.text[:80])

    norms = client.get("/api/vehicle-norms").json()
    nid = None
    for row in norms:
        if row.get("vehicle_model_code") == "RX350" and row.get("status") == "ACTIVE":
            nid = row.get("norm_id")
            break
    if not nid and norms:
        nid = norms[0].get("norm_id")
    ok11 = bool(nid)
    r_put_n = None
    if nid:
        r_put_n = client.put(
            f"/api/vehicle-norms/{nid}",
            json={
                "reason": "smoke chỉnh norm",
                "updated_by": "SMOKE",
                "windshield_size": "90x152",
                "note": "smoke-note",
            },
        )
        ok11 = r_put_n.status_code == 200
    add(11, "PUT vehicle-norms norm thành công", ok11, (r_put_n.text if r_put_n else "")[:100])

    if nid:
        r_put_n_fail = client.put(
            f"/api/vehicle-norms/{nid}",
            json={"windshield_size": "1x1", "updated_by": "SMOKE"},
        )
    else:

        class _NoNorm:
            status_code = 400
            text = "no norm"

        r_put_n_fail = _NoNorm()
    add(12, "PUT vehicle-norms thiếu reason → 400", r_put_n_fail.status_code == 400, getattr(r_put_n_fail, "text", "")[:80])

    r_res = client.get(
        "/api/vehicle-norms/resolve",
        params={"vehicle_model_code": "RX350", "model_year": 2022, "film_type": "Phim cách nhiệt"},
    )
    jr = r_res.json() if r_res.status_code == 200 else {}
    add(13, "GET resolve RX350 2022", r_res.status_code == 200 and jr.get("found") is True, json.dumps(jr)[:100])

    p = subprocess.run(
        [sys.executable, "manual_order_customer_smoke_test.py"],
        cwd=__import__("os").path.dirname(__file__),
        capture_output=True,
        text=True,
    )
    ok14 = p.returncode == 0 and "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED" in (p.stdout or "")
    add(14, "manual_order_customer_smoke_test.py", ok14, (p.stderr or p.stdout or "")[-160:])

    _print_table()
    _print_frontend_checklist()

    failed = [x for x in ROWS if not x[2]]
    if failed:
        for n, name, _, det in failed:
            print(f"FAIL #{n} {name}: {det}")
        print("CUSTOMER ADDRESS & NORM UI FIX SMOKE TEST FAILED")
        sys.exit(1)
    print("CUSTOMER ADDRESS & NORM UI FIX SMOKE TEST PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
