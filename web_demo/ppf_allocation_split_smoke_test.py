# -*- coding: utf-8 -*-
"""Smoke: PPF allocation nhiều nguồn — PUT /api/workstreams/{id}/ppf-allocation + approve + complete."""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import date

from fastapi.testclient import TestClient

from database import (
    SessionLocal,
    init_db,
    DbCustomer,
    DbDealer,
    DbJobCard,
    DbLotInventory,
    DbRequest,
    DbVehicleProfile,
    DbWorkstream,
)
from main import app

client = TestClient(app)
ROWS = []


def add(n, name, ok, detail=""):
    ROWS.append((n, name, ok, detail))


def _print_table():
    print("")
    print("| # | Case | Result | Detail |")
    print("|---:|---|:---:|---|")
    for n, name, ok, detail in sorted(ROWS, key=lambda x: x[0]):
        r = "PASS" if ok else "FAIL"
        d = (detail or "").replace("|", "\\|")[:120]
        print(f"| {n} | {name} | **{r}** | {d} |")
    print("")


def _subrun(script: str, expect_line: str, require_exit_code: bool = True) -> tuple:
    import os

    d = os.path.dirname(__file__)
    p = subprocess.run(
        [sys.executable, script],
        cwd=d,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (p.stdout or "") + "\n" + (p.stderr or "")
    rc_ok = (p.returncode == 0) if require_exit_code else True
    ok = rc_ok and expect_line in out
    return ok, out[-500:]


def _base_items_from_get(wsid: str):
    r = client.get(f"/api/workstreams/{wsid}")
    assert r.status_code == 200, r.text
    alloc = r.json().get("ppf_allocation") or {}
    return json.loads(json.dumps(alloc))


def _put_alloc(wsid: str, body: dict):
    return client.put(f"/api/workstreams/{wsid}/ppf-allocation", json=body)


def _ensure_ppf_pending_ws(db) -> tuple[str, str, str, str]:
    """(request_id, ws_id, lot1_id, lot2_id) — T-TYPE lots."""
    from populate_db import _ensure_five_lots_per_material

    _ensure_five_lots_per_material(db)
    lots = (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == "T-TYPE", DbLotInventory.status == "ACTIVE")
        .order_by(DbLotInventory.lot_id)
        .all()
    )
    if len(lots) < 2:
        raise RuntimeError("Cần ≥2 LOT T-TYPE sau _ensure_five_lots_per_material")
    l1, l2 = lots[0].lot_id, lots[1].lot_id
    for lo in lots:
        lo.remaining_length_m = max(float(lo.remaining_length_m or 0), 15.0)
        lo.is_locked = False
        lo.locked_by_request_id = None
        lo.locked_by_workstream_id = None
    dealer = db.query(DbDealer).first()
    cust = db.query(DbCustomer).first()
    vp = db.query(DbVehicleProfile).first()
    if not dealer or not cust or not vp:
        raise RuntimeError("Thiếu dealer/customer/vehicle seed")
    rid = "REQ-PPF-ALLOC-SPLIT-SMOKE"
    wsid = "WS-PPF-ALLOC-SPLIT-SMOKE"
    db.query(DbJobCard).filter(DbJobCard.workstream_id == wsid).delete()
    db.query(DbWorkstream).filter(DbWorkstream.workstream_id == wsid).delete()
    db.query(DbRequest).filter(DbRequest.request_id == rid).delete()
    db.flush()
    db.add(
        DbRequest(
            request_id=rid,
            dealer_id=dealer.dealer_id,
            customer_id=cust.customer_id,
            customer_name=cust.customer_name or "SMOKE",
            vehicle_id=vp.vehicle_id,
            vin_number=vp.vin_number or "VIN-SMOKE",
            vehicle_model_code=vp.vehicle_model_code or "LEXUS_RX350",
            material_code="T-TYPE",
            job_items="PPF_FULL",
            status="ALLOCATED",
            is_multi_workstream=False,
            is_grouped_cut=False,
            planned_cut_block="152x1300",
            planned_deduction_length_m=13.0,
            allocated_source_type="LOT",
            allocated_source_id=l1,
            created_at=date.today().isoformat(),
        )
    )
    db.add(
        DbWorkstream(
            workstream_id=wsid,
            request_id=rid,
            workstream_type="PPF_INSTALLATION",
            team_type="PPF_TEAM",
            technician_team="PPF_TEAM_A",
            assigned_technician_id="KTV-PPF-001",
            assigned_technician_name="KTV Smoke",
            selected_material_code="T-TYPE",
            planned_cut_block="152x1300",
            planned_deduction_length_m=13.0,
            allocated_source_type="LOT",
            allocated_source_id=l1,
            status="PENDING_APPROVAL",
            actual_confirmation_status="PENDING",
            created_at=date.today().isoformat(),
        )
    )
    db.commit()
    return rid, wsid, l1, l2


def main():
    init_db()

    # 13–15: regression smokes trước khi chỉnh DB nặng (approve/complete PPF)
    ok13, d13 = _subrun(
        "material_preference_manual_order_smoke_test.py",
        "MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED",
    )
    add(13, "material_preference_manual_order_smoke_test", ok13, d13[:200])
    ok14, d14 = _subrun("inventory_admin_smoke_test.py", "INVENTORY ADMIN SMOKE TEST PASSED")
    add(14, "inventory_admin_smoke_test", ok14, d14[:200])
    ok15, d15 = _subrun("manual_order_customer_smoke_test.py", "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED")
    add(15, "manual_order_customer_smoke_test", ok15, d15[:200])

    db = SessionLocal()
    try:
        rid, wsid, l1, l2 = _ensure_ppf_pending_ws(db)
    finally:
        db.close()

    # 1
    r1 = client.get(f"/api/workstreams/{wsid}")
    add(1, "GET PPF workstream + ppf_allocation", r1.status_code == 200 and "ppf_allocation" in r1.json(), r1.text[:80])

    base = _base_items_from_get(wsid)

    # 2 — một nguồn đủ 13m
    body1 = {
        "ppf_type": "T-TYPE",
        "required_total_length_m": 13.0,
        "items": base["items"],
        "change_reason": "Smoke test — một nguồn đủ 13m.",
    }
    full = next(x for x in body1["items"] if x["item_code"] == "FULL_VEHICLE_PPF")
    full["sources"] = [{"source_type": "LOT", "source_id": l1, "allocated_length_m": 13.0, "note": ""}]
    r2 = _put_alloc(wsid, body1)
    add(2, "PUT 1 nguồn đủ 13m", r2.status_code == 200 and r2.json().get("ok") is True, r2.text[:120])

    # 3 — 2 nguồn cộng đủ 13m
    body2 = json.loads(json.dumps(body1))
    full2 = next(x for x in body2["items"] if x["item_code"] == "FULL_VEHICLE_PPF")
    full2["sources"] = [
        {"source_type": "LOT", "source_id": l1, "allocated_length_m": 7.2, "note": ""},
        {"source_type": "LOT", "source_id": l2, "allocated_length_m": 5.8, "note": ""},
    ]
    body2["change_reason"] = "Smoke — chia 2 LOT."
    r3 = _put_alloc(wsid, body2)
    add(3, "PUT 2 nguồn đủ 13m", r3.status_code == 200, r3.text[:120])

    # 4 — thiếu mét
    body3 = json.loads(json.dumps(body2))
    next(x for x in body3["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": l1, "allocated_length_m": 5.0, "note": ""},
        {"source_type": "LOT", "source_id": l2, "allocated_length_m": 5.0, "note": ""},
    ]
    body3["change_reason"] = "Smoke — thiếu mét."
    r4 = _put_alloc(wsid, body3)
    j4 = r4.json() if r4.headers.get("content-type", "").startswith("application/json") else {}
    err4 = (j4.get("detail") or {}).get("error") if isinstance(j4.get("detail"), dict) else None
    add(4, "PUT tổng < 13m fail", r4.status_code == 400 and err4 == "PPF_ALLOCATION_INSUFFICIENT_LENGTH", str(j4)[:120])

    # 5 — nguồn không tồn tại
    body5 = json.loads(json.dumps(body2))
    next(x for x in body5["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": "LOT-DOES-NOT-EXIST-999", "allocated_length_m": 13.0, "note": ""},
    ]
    body5["change_reason"] = "Smoke bad lot."
    r5 = _put_alloc(wsid, body5)
    j5 = r5.json() if r5.status_code != 200 else {}
    err5 = (j5.get("detail") or {}).get("error") if isinstance(j5.get("detail"), dict) else None
    add(5, "PUT LOT không tồn tại fail", r5.status_code == 400 and err5 == "PPF_SOURCE_NOT_FOUND", str(j5)[:120])

    # 6 — material mismatch (JB20 lot với PPF T-TYPE)
    db = SessionLocal()
    jb = db.query(DbLotInventory).filter(DbLotInventory.material_code == "JB20").first()
    db.close()
    if jb:
        body6 = json.loads(json.dumps(body2))
        next(x for x in body6["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
            {"source_type": "LOT", "source_id": jb.lot_id, "allocated_length_m": 13.0, "note": ""},
        ]
        body6["change_reason"] = "Smoke mismatch."
        r6 = _put_alloc(wsid, body6)
        j6 = r6.json() if r6.status_code != 200 else {}
        err6 = (j6.get("detail") or {}).get("error") if isinstance(j6.get("detail"), dict) else None
        add(6, "PUT material mismatch fail", r6.status_code == 400 and err6 == "PPF_SOURCE_MATERIAL_MISMATCH", str(j6)[:120])
    else:
        add(6, "PUT material mismatch fail (skip — không có JB20)", True, "")

    # 7 — locked bởi request khác
    db = SessionLocal()
    lot_row = db.query(DbLotInventory).filter(DbLotInventory.lot_id == l1).first()
    if lot_row:
        lot_row.is_locked = True
        lot_row.locked_by_request_id = "REQ-OTHER-LOCK-HOLDER"
        lot_row.locked_by_workstream_id = None
        db.commit()
    db.close()
    body7 = json.loads(json.dumps(body2))
    next(x for x in body7["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": l1, "allocated_length_m": 13.0, "note": ""},
    ]
    body7["change_reason"] = "Smoke lock test."
    r7 = _put_alloc(wsid, body7)
    j7 = r7.json() if r7.status_code != 200 else {}
    err7 = (j7.get("detail") or {}).get("error") if isinstance(j7.get("detail"), dict) else None
    add(7, "PUT source locked fail", r7.status_code == 400 and err7 == "PPF_SOURCE_LOCKED", str(j7)[:120])
    db = SessionLocal()
    lot_row = db.query(DbLotInventory).filter(DbLotInventory.lot_id == l1).first()
    if lot_row:
        lot_row.is_locked = False
        lot_row.locked_by_request_id = None
        lot_row.locked_by_workstream_id = None
        db.commit()
    db.close()

    # restore valid split for next tests
    _put_alloc(wsid, body2)

    # 8 — đổi nguồn không có change_reason (diff so với đã lưu)
    body8 = json.loads(json.dumps(body2))
    next(x for x in body8["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": l2, "allocated_length_m": 13.0, "note": ""},
    ]
    body8.pop("change_reason", None)
    r8 = _put_alloc(wsid, body8)
    j8 = r8.json() if r8.status_code != 200 else {}
    err8 = (j8.get("detail") or {}).get("error") if isinstance(j8.get("detail"), dict) else None
    add(8, "PUT đổi nguồn thiếu reason fail", r8.status_code == 400 and err8 == "PPF_CHANGE_REASON_REQUIRED", str(j8)[:120])

    # 9 — tick thêm hạng mục qty=0
    body9 = json.loads(json.dumps(body2))
    for it in body9["items"]:
        if it["item_code"] == "HOOD_PPF":
            it["is_selected"] = True
            it["quantity"] = 0
            it["required_length_m"] = 1.0
    body9["change_reason"] = "Smoke invalid qty."
    r9 = _put_alloc(wsid, body9)
    j9 = r9.json() if r9.status_code != 200 else {}
    err9 = (j9.get("detail") or {}).get("error") if isinstance(j9.get("detail"), dict) else None
    add(9, "PUT tick HOOD qty=0 fail", r9.status_code == 400 and err9 == "PPF_INVALID_ITEM_QUANTITY", str(j9)[:120])

    # 10–12 approve split → start → submit-actual → complete (trừ từng nguồn)
    rrestore = _put_alloc(wsid, body2)
    assert rrestore.status_code == 200, rrestore.text
    r10 = client.post(f"/api/workstreams/{wsid}/approve", json={"approved_by": "QL-SMOKE"})
    jget = client.get(f"/api/workstreams/{wsid}").json()
    pa = jget.get("ppf_allocation") or {}
    lot_ids_locked = []
    for it in pa.get("items", []):
        for s in it.get("sources") or []:
            if (s.get("source_type") or "LOT").upper() == "LOT" and (s.get("source_id") or "").strip():
                lot_ids_locked.append(s["source_id"].strip())
    db = SessionLocal()
    locked_ok = True
    for lid in lot_ids_locked:
        lo = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lid).first()
        locked_ok = locked_ok and bool(lo and lo.is_locked)
    db.close()
    add(
        10,
        "Manager approve — soft lock mọi LOT trong allocation",
        r10.status_code == 200 and len(lot_ids_locked) >= 2 and locked_ok,
        r10.text[:100] + f" | lots={lot_ids_locked}",
    )

    r11 = client.post(f"/api/workstreams/{wsid}/start")
    add(11, "KTV start", r11.status_code == 200, r11.text[:80])

    r12a = client.post(
        f"/api/workstreams/{wsid}/submit-actual",
        json={
            "actual_cut_block": "152x1300",
            "actual_length_m": 13.0,
            "has_new_offcut": False,
            "has_scrap": False,
        },
    )
    r12b = client.post(f"/api/workstreams/{wsid}/complete", json={"technician_id": "KTV-PPF-001"})
    db = SessionLocal()
    ws_done = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == wsid).first()
    lot_a = db.query(DbLotInventory).filter(DbLotInventory.lot_id == l1).first()
    lot_b = db.query(DbLotInventory).filter(DbLotInventory.lot_id == l2).first()
    ok12 = (
        r12a.status_code == 200
        and r12b.status_code == 200
        and ws_done
        and ws_done.status == "CLOSED"
        and ws_done.inventory_committed
        and not (lot_a.is_locked if lot_a else True)
        and not (lot_b.is_locked if lot_b else True)
    )
    db.close()
    add(12, "WF6 complete — trừ 2 LOT + release lock", ok12, (r12b.text or "")[:120])

    _print_table()
    failed = [x for x in ROWS if not x[2]]
    if failed:
        print("FAILED:", failed)
        sys.exit(1)
    print("PPF ALLOCATION SPLIT SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
