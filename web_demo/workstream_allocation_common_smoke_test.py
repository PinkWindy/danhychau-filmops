# -*- coding: utf-8 -*-
"""Smoke: API allocation chung + active-options + PPF/WF (≥18 case)."""
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
    DbOffcutInventory,
    DbRequest,
    DbVehicleProfile,
    DbWorkstream,
)
from main import _create_workstreams_for_request, app

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


def _subrun(script: str, expect_line: str) -> tuple:
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
    ok = (p.returncode == 0) and expect_line in out
    return ok, out[-500:]


def _put_allocation(ws_id: str, body: dict):
    b = dict(body)
    if "workstream_type" not in b:
        ws = client.get(f"/api/workstreams/{ws_id}").json()
        b["workstream_type"] = ws.get("workstream_type")
    return client.put(f"/api/workstreams/{ws_id}/allocation", json=b)


def _wf_approve_materials_preflight(ws_id: str) -> None:
    """PUT WF /allocation chỉ khi PENDING_TECH_PREFLIGHT — chuyển từ PENDING_APPROVAL nếu cần."""
    info = client.get(f"/api/workstreams/{ws_id}").json()
    if info.get("workstream_type") != "WINDOW_FILM_INSTALLATION" or info.get("status") != "PENDING_APPROVAL":
        return
    mp = info.get("material_plan")
    if isinstance(mp, str):
        try:
            mp = json.loads(mp or "[]")
        except json.JSONDecodeError:
            mp = []
    r = client.post(
        f"/api/workstreams/{ws_id}/approve-wf-materials",
        json={"reason": "smoke WF material plan approved", "material_plan": mp},
    )
    if r.status_code != 200:
        raise RuntimeError(f"approve-wf-materials failed {ws_id}: {r.status_code} {r.text[:500]}")


def _ensure_multi_ws(db, request_id: str = "REQ-CMN78-WSALLOC") -> tuple[str, str, str, str, str, str]:
    """rid, ppf_id, wf_id, ttype_l1, ttype_l2, wf_wind_lot_id — LOT kính lái đúng Material Preference (không hardcode JB20)."""
    from material_preference_logic import resolve_material_preference
    from populate_db import _ensure_five_lots_per_material

    _ensure_five_lots_per_material(db)
    wind_res = resolve_material_preference(db, "Phim cách nhiệt", "WINDSHIELD")
    wf_wind_mc = (wind_res.get("preferred_material_code") or "").strip()
    if not wf_wind_mc:
        raise RuntimeError("Thiếu Material Preference cho WINDSHIELD (seed material_preferences)")

    tlots = (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == "T-TYPE", DbLotInventory.status == "ACTIVE")
        .order_by(DbLotInventory.lot_id)
        .all()
    )
    jlots = (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == "JB20", DbLotInventory.status == "ACTIVE")
        .order_by(DbLotInventory.lot_id)
        .all()
    )
    if len(tlots) < 2 or not jlots:
        raise RuntimeError("Cần ≥2 LOT T-TYPE và ≥1 LOT JB20")
    t1, t2 = tlots[0].lot_id, tlots[1].lot_id
    for lo in tlots + jlots:
        lo.remaining_length_m = max(float(lo.remaining_length_m or 0), 25.0)
        lo.is_locked = False
        lo.locked_by_request_id = None
        lo.locked_by_workstream_id = None
        if lo.lot_id == jlots[0].lot_id:
            lo.lot_status = "IN_USE"

    rid = request_id
    dealer = db.query(DbDealer).first()
    cust = db.query(DbCustomer).first()
    vp = db.query(DbVehicleProfile).first()
    if not dealer or not cust or not vp:
        raise RuntimeError("Thiếu seed")

    for ws in db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).all():
        db.query(DbJobCard).filter(DbJobCard.workstream_id == ws.workstream_id).delete()
    db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete()
    db.query(DbRequest).filter(DbRequest.request_id == rid).delete()
    db.flush()

    db.add(
        DbRequest(
            request_id=rid,
            dealer_id=dealer.dealer_id,
            customer_id=cust.customer_id,
            customer_name=cust.customer_name or "SMOKE-COMMON",
            vehicle_id=vp.vehicle_id,
            vin_number=vp.vin_number or "VIN-CMN78",
            vehicle_model_code=vp.vehicle_model_code or "LEXUS_RX350",
            material_code="T-TYPE",
            job_items="PPF_FULL;WINDOW_FILM",
            status="ALLOCATED",
            is_multi_workstream=True,
            is_grouped_cut=False,
            planned_cut_block="152x1300",
            planned_deduction_length_m=13.0,
            allocated_source_type="LOT",
            allocated_source_id=t1,
            created_at=date.today().isoformat(),
            service_selection_json=json.dumps(
                {"include_window_film": True, "window_film_items": ["WINDSHIELD"]}, ensure_ascii=False
            ),
        )
    )
    db.flush()
    req = db.query(DbRequest).filter(DbRequest.request_id == rid).first()
    _create_workstreams_for_request(db, req)
    db.flush()
    wf_row = (
        db.query(DbWorkstream)
        .filter(DbWorkstream.request_id == rid, DbWorkstream.workstream_type == "WINDOW_FILM_INSTALLATION")
        .first()
    )
    if wf_row and wf_row.material_plan:
        try:
            plan_fix = json.loads(wf_row.material_plan)
        except json.JSONDecodeError:
            plan_fix = []
        _changed = False
        for row in plan_fix:
            if row.get("job_item") != "WINDSHIELD":
                continue
            w0 = float(row.get("width_cm") or 0)
            l0 = float(row.get("length_cm") or 0)
            if w0 <= 0 or l0 <= 0:
                row["width_cm"] = 90.0
                row["length_cm"] = 152.0
                row["size"] = "90x152"
                _changed = True
        if _changed:
            wf_row.material_plan = json.dumps(plan_fix, ensure_ascii=False)
            from wf_allocation_service import build_default_wf_allocation

            wf_row.wf_allocation_json = json.dumps(build_default_wf_allocation(db, wf_row), ensure_ascii=False)
            db.flush()
    wind_mc = wf_wind_mc
    if wf_row and wf_row.wf_allocation_json:
        try:
            _items = json.loads(wf_row.wf_allocation_json).get("items") or []
            _wi = next((x for x in _items if x.get("item_code") == "WINDSHIELD"), {})
            _m = (_wi.get("material_code") or "").strip()
            if _m:
                wind_mc = _m
        except (json.JSONDecodeError, TypeError):
            pass
    wind_lots = (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == wind_mc, DbLotInventory.status == "ACTIVE")
        .order_by(DbLotInventory.lot_id)
        .all()
    )
    if not wind_lots:
        raise RuntimeError(f"Không có LOT ACTIVE cho mã kính lái ({wind_mc}) theo plan/preference.")
    wf_wind_lot_id = wind_lots[0].lot_id
    for lo in wind_lots:
        lo.remaining_length_m = max(float(lo.remaining_length_m or 0), 25.0)
        lo.is_locked = False
        lo.locked_by_request_id = None
        lo.locked_by_workstream_id = None

    db.commit()

    wss = db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).all()
    ppf = next(w for w in wss if w.workstream_type == "PPF_INSTALLATION")
    wf2 = next(w for w in wss if w.workstream_type == "WINDOW_FILM_INSTALLATION")
    return rid, ppf.workstream_id, wf2.workstream_id, t1, t2, wf_wind_lot_id


def main():
    init_db()

    ok17, d17 = _subrun(
        "material_preference_manual_order_smoke_test.py",
        "MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED",
    )
    add(17, "material_preference_manual_order_smoke_test", ok17, d17[:200])
    ok18, d18 = _subrun("inventory_admin_smoke_test.py", "INVENTORY ADMIN SMOKE TEST PASSED")
    add(18, "inventory_admin_smoke_test", ok18, d18[:200])
    ok19, d19 = _subrun(
        "manual_order_customer_smoke_test.py",
        "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED",
    )
    add(19, "manual_order_customer_smoke_test", ok19, d19[:200])

    db = SessionLocal()
    try:
        rid, ppf_id, wf_id, t1, t2, wf_lot = _ensure_multi_ws(db)
    finally:
        db.close()

    # 1 — active-options JB20
    r1 = client.get("/api/inventory/lots/active-options", params={"material_code": "JB20", "request_id": rid})
    j1 = r1.json() if r1.status_code == 200 else {}
    items1 = j1.get("items") or []
    ok1 = r1.status_code == 200 and len(items1) > 0 and all(x.get("source_type") == "LOT" for x in items1)
    add(1, "GET lots/active-options JB20", ok1, f"count={len(items1)}")

    # 2 — offcuts active-options JB20 (nếu có)
    r2 = client.get("/api/inventory/offcuts/active-options", params={"material_code": "JB20", "request_id": rid})
    j2 = r2.json() if r2.status_code == 200 else {}
    ok2 = r2.status_code == 200 and "items" in j2
    add(2, "GET offcuts/active-options JB20", ok2, f"count={len(j2.get('items') or [])}")

    # 3 — không trả LOT terminal (CLOSED)
    db = SessionLocal()
    lot_bad = db.query(DbLotInventory).filter(DbLotInventory.material_code == "JB20").order_by(DbLotInventory.lot_id.desc()).first()
    lot_bad_id = lot_bad.lot_id if lot_bad else None
    old_st = lot_bad.lot_status if lot_bad else None
    if lot_bad:
        lot_bad.lot_status = "CLOSED"
        db.commit()
    db.close()
    r3 = client.get("/api/inventory/lots/active-options", params={"material_code": "JB20"})
    j3 = r3.json() if r3.status_code == 200 else {}
    ids3 = [x.get("source_id") for x in (j3.get("items") or [])]
    ok3 = lot_bad_id is None or (lot_bad_id not in ids3)
    db = SessionLocal()
    lb = db.query(DbLotInventory).filter(DbLotInventory.lot_id == lot_bad_id).first() if lot_bad_id else None
    if lb and old_st is not None:
        lb.lot_status = old_st
        db.commit()
    db.close()
    add(3, "lots/active-options không gồm LOT CLOSED", ok3, "")

    # 4 — OFFCUT terminal không có trong active-options
    db = SessionLocal()
    oc_bad = (
        db.query(DbOffcutInventory)
        .filter(DbOffcutInventory.material_code == "JB20", DbOffcutInventory.offcut_status != "USED")
        .first()
    )
    oc_bad_id = oc_bad.offcut_id if oc_bad else None
    old_oc = oc_bad.offcut_status if oc_bad else None
    if oc_bad:
        oc_bad.offcut_status = "USED"
        db.commit()
    db.close()
    r4 = client.get("/api/inventory/offcuts/active-options", params={"material_code": "JB20"})
    j4 = r4.json() if r4.status_code == 200 else {}
    ids4 = [x.get("source_id") for x in (j4.get("items") or [])]
    ok4 = oc_bad_id is None or (oc_bad_id not in ids4)
    if oc_bad_id:
        db = SessionLocal()
        ob = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == oc_bad_id).first()
        if ob and old_oc:
            ob.offcut_status = old_oc
            db.commit()
        db.close()
    add(4, "offcuts/active-options không gồm USED (seed tạm)", ok4, "")

    # 5–9 PPF qua /allocation
    base_p = client.get(f"/api/workstreams/{ppf_id}").json().get("ppf_allocation") or {}
    body5 = {
        "workstream_type": "PPF_INSTALLATION",
        "ppf_type": "T-TYPE",
        "required_total_length_m": 13.0,
        "items": json.loads(json.dumps(base_p.get("items") or [])),
        "change_reason": "smoke5",
    }
    f5 = next(x for x in body5["items"] if x["item_code"] == "FULL_VEHICLE_PPF")
    f5["sources"] = [{"source_type": "LOT", "source_id": t1, "allocated_length_m": 13.0, "note": ""}]
    r5 = _put_allocation(ppf_id, body5)
    add(5, "PUT allocation PPF 1 nguồn đủ 13m", r5.status_code == 200 and r5.json().get("ok") is True, r5.text[:80])

    body6 = json.loads(json.dumps(body5))
    f6 = next(x for x in body6["items"] if x["item_code"] == "FULL_VEHICLE_PPF")
    f6["sources"] = [
        {"source_type": "LOT", "source_id": t1, "allocated_length_m": 7.2, "note": ""},
        {"source_type": "LOT", "source_id": t2, "allocated_length_m": 5.8, "note": ""},
    ]
    body6["change_reason"] = "smoke6 split"
    r6 = _put_allocation(ppf_id, body6)
    add(6, "PUT allocation PPF 2 nguồn đủ 13m", r6.status_code == 200, r6.text[:80])

    body7 = json.loads(json.dumps(body6))
    next(x for x in body7["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": t1, "allocated_length_m": 5.0, "note": ""},
        {"source_type": "LOT", "source_id": t2, "allocated_length_m": 5.0, "note": ""},
    ]
    body7["change_reason"] = "smoke7"
    r7 = _put_allocation(ppf_id, body7)
    e7 = (r7.json().get("detail") or {}).get("error") if isinstance(r7.json().get("detail"), dict) else None
    add(7, "PUT PPF tổng < 13m fail", r7.status_code == 400 and e7 == "PPF_ALLOCATION_INSUFFICIENT_LENGTH", str(r7.json())[:100])

    _put_allocation(ppf_id, body6)
    body8 = json.loads(json.dumps(body6))
    next(x for x in body8["items"] if x["item_code"] == "FULL_VEHICLE_PPF")["sources"] = [
        {"source_type": "LOT", "source_id": t2, "allocated_length_m": 13.0, "note": ""},
    ]
    body8.pop("change_reason", None)
    r8 = _put_allocation(ppf_id, body8)
    e8 = (r8.json().get("detail") or {}).get("error") if isinstance(r8.json().get("detail"), dict) else None
    add(8, "PUT PPF đổi nguồn thiếu reason fail", r8.status_code == 400 and e8 == "PPF_CHANGE_REASON_REQUIRED", str(r8.json())[:80])

    body9 = json.loads(json.dumps(body6))
    for it in body9["items"]:
        if it["item_code"] == "HOOD_PPF":
            it["is_selected"] = True
            it["quantity"] = 0
    body9["change_reason"] = "smoke9"
    r9 = _put_allocation(ppf_id, body9)
    e9 = (r9.json().get("detail") or {}).get("error") if isinstance(r9.json().get("detail"), dict) else None
    add(9, "PUT PPF tick phụ qty=0 fail", r9.status_code == 400 and e9 == "PPF_INVALID_ITEM_QUANTITY", str(r9.json())[:80])
    _put_allocation(ppf_id, body6)

    # 10–13 WF (trước hết duyệt mã phim → PENDING_TECH_PREFLIGHT mới PUT allocation)
    _wf_approve_materials_preflight(wf_id)
    wf_json = client.get(f"/api/workstreams/{wf_id}").json()
    wfa = wf_json.get("wf_allocation") or {}
    body10 = {
        "workstream_type": "WINDOW_FILM_INSTALLATION",
        "items": json.loads(json.dumps(wfa.get("items") or [])),
        "change_reason": "smoke10 wf windshield",
    }
    ws10 = next((x for x in body10["items"] if x["item_code"] == "WINDSHIELD"), None)
    ok10a = ws10 is not None and ws10.get("is_selected")
    rp10 = client.get(
        "/api/material-preferences/resolve",
        params={"film_type": "Phim cách nhiệt", "job_item": "WINDSHIELD"},
    ).json()
    exp_mc10 = (rp10.get("preferred_material_code") or "").strip()
    mc10 = ((ws10 or {}).get("material_code") or "").strip()
    ok10_pref = bool(exp_mc10) and mc10.upper() == exp_mc10.upper()
    dbl10 = SessionLocal()
    rowl10 = dbl10.query(DbLotInventory).filter(DbLotInventory.lot_id == wf_lot).first()
    dbl10.close()
    ok10_lot = bool(rowl10 and (rowl10.material_code or "").strip().upper() == mc10.upper() and mc10)
    if ws10:
        ws10["sources"] = [
            {
                "source_type": "LOT",
                "source_id": wf_lot,
                "allocated_length_m": float(ws10.get("required_length_m") or 1.43),
                "note": "",
            }
        ]
    r10 = _put_allocation(wf_id, body10)
    add(
        10,
        "PUT allocation WF WINDSHIELD + LOT theo Material Preference",
        ok10a and ok10_pref and ok10_lot and r10.status_code == 200,
        f"material={mc10} lot={wf_lot} {r10.text[:60]}",
    )

    body11 = json.loads(json.dumps(body10))
    mat_wind = mc10 or exp_mc10
    oc_use = client.get("/api/inventory/offcuts/active-options", params={"material_code": mat_wind}).json()
    oc_list = oc_use.get("items") or []
    ok11 = True
    class _R11:
        status_code = 200
        text = "{}"

        def json(self):
            return {}

    r11 = _R11()
    if oc_list:
        w11 = next((x for x in body11["items"] if x["item_code"] == "WINDSHIELD"), None)
        if w11:
            oc_len = float(oc_list[0].get("length_m") or 0)
            need_m = float(w11.get("required_length_m") or 0) or 1.52
            take_m = min(need_m, oc_len)
            w11["sources"] = [
                {
                    "source_type": "OFFCUT",
                    "source_id": oc_list[0]["source_id"],
                    "allocated_length_m": take_m,
                    "note": "offcut",
                }
            ]
            w11["required_length_m"] = take_m
        body11["change_reason"] = "smoke11 offcut"
        r11 = _put_allocation(wf_id, body11)
        ok11 = r11.status_code == 200
    add(11, f"PUT WF WINDSHIELD + OFFCUT (nếu có offcut {mat_wind})", ok11, r11.text[:80])

    _put_allocation(wf_id, body10)
    body12 = json.loads(json.dumps(body10))
    w12 = next((x for x in body12["items"] if x["item_code"] == "WINDSHIELD"), None)
    if w12:
        need12 = float(w12.get("required_length_m") or 0) or 1.52
        w12["sources"] = [{"source_type": "LOT", "source_id": t1, "allocated_length_m": need12, "note": ""}]
    body12["change_reason"] = "bad mat"
    r12 = _put_allocation(wf_id, body12)
    e12 = (r12.json().get("detail") or {}).get("error") if isinstance(r12.json().get("detail"), dict) else None
    add(12, "PUT WF source material mismatch fail", r12.status_code == 400 and e12 == "WF_SOURCE_MATERIAL_MISMATCH", str(r12.json())[:100])

    _put_allocation(wf_id, body10)
    body13 = json.loads(json.dumps(body10))
    w13 = next((x for x in body13["items"] if x["item_code"] == "WINDSHIELD"), None)
    if w13:
        w13["sources"] = [{"source_type": "LOT", "source_id": wf_lot, "allocated_length_m": 2.0, "note": ""}]
    body13.pop("change_reason", None)
    r13 = _put_allocation(wf_id, body13)
    e13 = (r13.json().get("detail") or {}).get("error") if isinstance(r13.json().get("detail"), dict) else None
    add(13, "PUT WF đổi nguồn thiếu reason fail", r13.status_code == 400 and e13 == "WF_CHANGE_REASON_REQUIRED", str(r13.json())[:100])

    _put_allocation(wf_id, body10)

    # 14 — locked
    db = SessionLocal()
    lr = db.query(DbLotInventory).filter(DbLotInventory.lot_id == wf_lot).first()
    if lr:
        lr.is_locked = True
        lr.locked_by_request_id = "REQ-OTHER-LOCK"
        db.commit()
    db.close()
    body14 = json.loads(json.dumps(body10))
    r14 = _put_allocation(wf_id, body14)
    e14 = (r14.json().get("detail") or {}).get("error") if isinstance(r14.json().get("detail"), dict) else None
    add(14, "PUT WF / PPF source locked fail", r14.status_code == 400 and e14 in ("WF_SOURCE_LOCKED", "PPF_SOURCE_LOCKED"), str(r14.json())[:100])
    db = SessionLocal()
    lr2 = db.query(DbLotInventory).filter(DbLotInventory.lot_id == wf_lot).first()
    if lr2:
        lr2.is_locked = False
        lr2.locked_by_request_id = None
        db.commit()
    db.close()
    _put_allocation(wf_id, body10)

    # 15–16 approve WF + commit (1 nguồn đúng material kính lái)
    r15 = client.post(f"/api/workstreams/{wf_id}/approve", json={"approved_by": "QL-SMOKE-WF"})
    db = SessionLocal()
    lochk = db.query(DbLotInventory).filter(DbLotInventory.lot_id == wf_lot).first()
    ok15 = r15.status_code == 200 and bool(lochk and lochk.is_locked)
    db.close()
    add(15, "Manager approve WF — soft lock nguồn", ok15, r15.text[:100])

    client.post(f"/api/workstreams/{wf_id}/start")
    need = float(next(x for x in body10["items"] if x["item_code"] == "WINDSHIELD")["required_length_m"] or 1.52)
    r16a = client.post(
        f"/api/workstreams/{wf_id}/submit-actual",
        json={
            "actual_cut_block": "152x143",
            "actual_length_m": need,
            "has_new_offcut": False,
            "has_scrap": False,
        },
    )
    r16b = client.post(f"/api/workstreams/{wf_id}/complete", json={"technician_id": "KTV-003"})
    db = SessionLocal()
    wf_done = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == wf_id).first()
    lot_after = db.query(DbLotInventory).filter(DbLotInventory.lot_id == wf_lot).first()
    ok16 = (
        r16a.status_code == 200
        and r16b.status_code == 200
        and wf_done
        and wf_done.status == "CLOSED"
        and not (lot_after.is_locked if lot_after else False)
    )
    db.close()
    add(16, "WF6 complete WF — trừ LOT + release lock", ok16, (r16b.text or "")[:100])

    # 20 — GET workstreams có wf_allocation (sau khi WF đãng — dùng GET lại rid vẫn ok check ppf còn)
    r20 = client.get(f"/api/requests/{rid}/workstreams")
    ok20 = r20.status_code == 200 and any(x.get("wf_allocation") for x in r20.json())
    add(20, "GET workstreams — từng WS có wf_allocation khi có dữ liệu", ok20, "")

    _print_table()
    if not all(x[2] for x in ROWS):
        sys.exit(1)
    print("WORKSTREAM ALLOCATION COMMON SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
