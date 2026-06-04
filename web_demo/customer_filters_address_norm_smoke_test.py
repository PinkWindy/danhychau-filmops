# -*- coding: utf-8 -*-
"""
Smoke: Customer list filters, vehicle norms filters, PUT norms/dealers/customers, activate/deactivate.
Run from web_demo:  python customer_filters_address_norm_smoke_test.py
"""
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from database import init_db, SessionLocal, DbDealer, DbCustomer, DbVehicleFilmNorm
from main import app

client = TestClient(app)
ROWS = []
HERE = Path(__file__).resolve().parent


def add(n, name, ok, detail=""):
    ROWS.append((n, name, ok, detail))


def _ok200(resp):
    return resp.status_code == 200


def _first_norm_id():
    db = SessionLocal()
    try:
        row = db.query(DbVehicleFilmNorm).order_by(DbVehicleFilmNorm.norm_id).first()
        return row.norm_id if row else None
    finally:
        db.close()


def _first_dealer_id():
    db = SessionLocal()
    try:
        row = db.query(DbDealer).order_by(DbDealer.dealer_id).first()
        return row.dealer_id if row else None
    finally:
        db.close()


def _first_customer_id():
    """Prefer non-VERIFIED để PUT địa chỉ không bị chặn business rule."""
    db = SessionLocal()
    try:
        row = db.query(DbCustomer).filter(DbCustomer.crm_status != "VERIFIED").first()
        if row:
            return row.customer_id
        row2 = db.query(DbCustomer).order_by(DbCustomer.customer_id).first()
        return row2.customer_id if row2 else None
    finally:
        db.close()


def main():
    init_db()
    add(1, "GET /api/dealers?q=LEXUS", _ok200(client.get("/api/dealers", params={"q": "LEXUS"})), "")
    add(2, "GET /api/dealers?status=ACTIVE", _ok200(client.get("/api/dealers", params={"status": "ACTIVE"})), "")
    add(
        3,
        "GET /api/dealers?city=Thành phố Hồ Chí Minh",
        _ok200(client.get("/api/dealers", params={"city": "Thành phố Hồ Chí Minh"})),
        "",
    )
    add(4, "GET /api/dealers?has_amis_code=true", _ok200(client.get("/api/dealers", params={"has_amis_code": "true"})), "")

    add(5, "GET /api/end-customers?q=KH", _ok200(client.get("/api/end-customers", params={"q": "KH"})), "")
    add(6, "GET /api/end-customers?source_channel=DEALER", _ok200(client.get("/api/end-customers", params={"source_channel": "DEALER"})), "")
    add(7, "GET /api/end-customers?has_vehicle=true", _ok200(client.get("/api/end-customers", params={"has_vehicle": "true"})), "")

    add(8, "GET /api/vehicles?vehicle_model_code=RX350", _ok200(client.get("/api/vehicles", params={"vehicle_model_code": "RX350"})), "")
    add(9, "GET /api/vehicles?has_active_norm=true", _ok200(client.get("/api/vehicles", params={"has_active_norm": "true"})), "")

    add(10, "GET /api/vehicle-norms?vehicle_model_code=RX350", _ok200(client.get("/api/vehicle-norms", params={"vehicle_model_code": "RX350"})), "")
    add(
        11,
        "GET /api/vehicle-norms?film_type=Phim cách nhiệt",
        _ok200(client.get("/api/vehicle-norms", params={"film_type": "Phim cách nhiệt"})),
        "",
    )
    add(12, "GET /api/vehicle-norms?status=ACTIVE", _ok200(client.get("/api/vehicle-norms", params={"status": "ACTIVE"})), "")

    nid = _first_norm_id()
    if nid:
        r_put_ok = client.put(
            f"/api/vehicle-norms/{nid}",
            json={
                "reason": "smoke resize",
                "windshield_size": "91x153",
                "updated_by": "SMOKE_FILTER",
            },
        )
        add(13, "PUT /api/vehicle-norms/{id} có reason", r_put_ok.status_code == 200, r_put_ok.text[:160])
        r_put_bad = client.put(f"/api/vehicle-norms/{nid}", json={"windshield_size": "90x152"})
        add(14, "PUT norm thiếu reason fail", r_put_bad.status_code == 400, r_put_bad.text[:120])
    else:
        add(13, "PUT norm (skip)", False, "no norm")
        add(14, "PUT norm fail (skip)", False, "no norm")

    did = _first_dealer_id()
    if did:
        r_dealer = client.put(
            f"/api/dealers/{did}",
            json={
                "reason": "smoke địa chỉ",
                "address_no": "123",
                "street": "Lê Lợi",
                "ward": "Bến Thành",
                "city": "Thành phố Hồ Chí Minh",
                "full_address": "123, Đường Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
                "updated_by": "SMOKE",
            },
        )
        add(15, "PUT /api/dealers/{id} địa chỉ + reason", r_dealer.status_code == 200, r_dealer.text[:120])
    else:
        add(15, "PUT dealer (skip)", False, "no dealer")

    cid = _first_customer_id()
    if cid:
        r_cust = client.put(
            f"/api/end-customers/{cid}",
            json={
                "reason": "smoke địa chỉ KH",
                "address_no": "5",
                "street": "Nguyễn Huệ",
                "ward": "Bến Nghé",
                "city": "Thành phố Hồ Chí Minh",
                "full_address": "5, Đường Nguyễn Huệ, Phường Bến Nghé, Thành phố Hồ Chí Minh",
                "updated_by": "SMOKE",
            },
        )
        if r_cust.status_code == 400:
            r_cust = client.put(
                f"/api/end-customers/{cid}",
                json={"reason": "smoke note only", "note": "smoke_filter_customer", "updated_by": "SMOKE"},
            )
        add(16, "PUT /api/end-customers/{id} có reason", r_cust.status_code == 200, r_cust.text[:160])
    else:
        add(16, "PUT customer (skip)", False, "no customer")

    if did:
        r_da = client.post(f"/api/dealers/{did}/deactivate", json={"reason": "smoke deactivate", "admin_override": True, "updated_by": "SMOKE"})
        r_db = client.post(f"/api/dealers/{did}/activate", json={"reason": "smoke activate", "updated_by": "SMOKE"})
        add(17, "POST /api/dealers/{id}/deactivate", r_da.status_code == 200, r_da.text[:80])
        add(18, "POST /api/dealers/{id}/activate", r_db.status_code == 200, r_db.text[:80])
    else:
        add(17, "POST dealer deactivate (skip)", False, "")
        add(18, "POST dealer activate (skip)", False, "")

    if cid:
        r_ca = client.post(f"/api/end-customers/{cid}/deactivate", json={"reason": "smoke off", "admin_override": True, "updated_by": "SMOKE"})
        r_cb = client.post(f"/api/end-customers/{cid}/activate", json={"reason": "smoke on", "updated_by": "SMOKE"})
        add(19, "POST /api/end-customers/{id}/deactivate", r_ca.status_code == 200, r_ca.text[:80])
        add(20, "POST /api/end-customers/{id}/activate", r_cb.status_code == 200, r_cb.text[:80])
    else:
        add(19, "POST customer deactivate (skip)", False, "")
        add(20, "POST customer activate (skip)", False, "")

    def _run(script):
        return subprocess.run(
            [sys.executable, str(HERE / script)],
            cwd=str(HERE),
            capture_output=True,
            text=True,
            timeout=180,
        )

    m = _run("manual_order_customer_smoke_test.py")
    add(21, "manual_order_customer_smoke_test.py", m.returncode == 0, (m.stderr or m.stdout or "")[-220:])
    inv = _run("inventory_admin_smoke_test.py")
    add(22, "inventory_admin_smoke_test.py", inv.returncode == 0, (inv.stderr or inv.stdout or "")[-220:])

    failed = [x for x in ROWS if not x[2]]
    passed = len([x for x in ROWS if x[2]])

    print("")
    for n, name, ok, det in ROWS:
        print(f"  [{n}] {'PASS' if ok else 'FAIL'} — {name} {(det or '')[:100]}")

    print("")
    print(f"Passed: {passed} / {len(ROWS)}; Failed: {len(failed)}")

    if not failed:
        print("")
        print("CUSTOMER FILTERS ADDRESS & NORM UI SMOKE TEST PASSED")
    else:
        print("")
        print("CUSTOMER FILTERS ADDRESS & NORM UI SMOKE TEST FAILED:", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
