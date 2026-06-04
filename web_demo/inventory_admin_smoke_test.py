# -*- coding: utf-8 -*-
"""
HTTP smoke tests for Inventory Admin APIs via FastAPI TestClient.

Requires: pip install httpx
Run: cd web_demo && python populate_db.py && python inventory_admin_smoke_test.py
"""
from __future__ import annotations

import os
import sys
import time

# Ensure imports resolve to this folder's main.py / database
_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(_ROOT)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from database import SessionLocal, DbLotInventory, DbOffcutInventory  # noqa: E402

client = TestClient(app)
TS = str(int(time.time()))


def _print_row(num: int, name: str, ok: bool, detail: str = "") -> None:
    st = "PASS" if ok else "FAIL"
    line = f"| {num:2d} | {st:4s} | {name[:52]:52s} | {detail[:60]}"
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"))


def _fail_detail(r, endpoint: str) -> str:
    try:
        body = r.json()
    except Exception:
        body = r.text[:500]
    return f"{endpoint} HTTP {r.status_code} {body!r}"


def ensure_locked_lot_demo():
    db = SessionLocal()
    try:
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == "LOT-DEMO-LOCKED-001").first()
        if lot:
            lot.is_locked = True
            lot.locked_by_request_id = "REQ-DEMO-CANCELLED"
            lot.locked_by_workstream_id = "WS-DEMO-OLD"
            lot.lot_status = "LOCKED"
        db.commit()
    finally:
        db.close()


def ensure_locked_offcut_demo():
    db = SessionLocal()
    try:
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == "SUBLOT-DEMO-LOCKED").first()
        if oc:
            oc.is_locked = True
            oc.locked_by_request_id = "REQ-DEMO-CANCELLED"
        db.commit()
    finally:
        db.close()


def main() -> int:
    results: list[tuple[int, str, bool, str]] = []
    lot_main = f"LOT-SMOKE-{TS}"
    oc_main = f"SUBLOT-SMOKE-{TS}"
    lot_nc = f"LOT-SMOKE-{TS}-NOREASON"
    lot_modes = [
        (f"LOT-SMOKE-{TS}-M1", "WRITE_OFF_TO_ZERO", "CLEARED"),
        (f"LOT-SMOKE-{TS}-M2", "MARK_AS_SCRAPPED", "SCRAPPED"),
        (f"LOT-SMOKE-{TS}-M3", "CLOSE_DEPLETED", "CLOSED"),
    ]
    oc_clear = f"SUBLOT-SMOKE-CLR-{TS}"

    def add(n, name, ok, detail=""):
        results.append((n, name, ok, detail))

    print("=" * 72)
    print("inventory_admin_smoke_test.py")
    print("=" * 72)
    print(f"| {'#':>2} | {'ST':^4} | {'Test':<52} | Detail")
    print("-" * 72)

    # 1 Import LOT OK
    r = client.post(
        "/api/inventory/lots/import",
        json={
            "lot_id": lot_main,
            "material_code": "JB20",
            "width_m": 1.52,
            "original_length_m": 10.0,
            "remaining_length_m": 10.0,
            "storage_location": "SMOKE-RACK",
            "performed_by": "SMOKE-TEST",
        },
    )
    ok = r.status_code == 200 and r.json().get("status") == "success"
    add(1, "Import LOT mới thành công", ok, "" if ok else _fail_detail(r, "POST /api/inventory/lots/import"))
    _print_row(1, "Import LOT mới thành công", ok, "")

    # 2 Duplicate lot_id
    r2 = client.post(
        "/api/inventory/lots/import",
        json={
            "lot_id": lot_main,
            "material_code": "JB20",
            "width_m": 1.52,
            "original_length_m": 10.0,
            "storage_location": "X",
            "performed_by": "SMOKE-TEST",
        },
    )
    ok2 = r2.status_code == 400
    add(2, "Import LOT trùng lot_id phải fail", ok2, "" if ok2 else _fail_detail(r2, "POST lots/import dup"))
    _print_row(2, "Import LOT trùng lot_id phải fail", ok2, "")

    # 3 remaining > original
    r3 = client.post(
        "/api/inventory/lots/import",
        json={
            "lot_id": f"LOT-SMOKE-{TS}-BADREM",
            "material_code": "JB20",
            "width_m": 1.52,
            "original_length_m": 5.0,
            "remaining_length_m": 99.0,
            "storage_location": "X",
            "performed_by": "SMOKE-TEST",
        },
    )
    ok3 = r3.status_code == 400
    add(3, "Import LOT remaining > original phải fail", ok3, "" if ok3 else _fail_detail(r3, "POST lots/import bad rem"))
    _print_row(3, "Import LOT remaining > original phải fail", ok3, "")

    # 4 Import offcut OK
    r4 = client.post(
        "/api/inventory/offcuts/import",
        json={
            "offcut_id": oc_main,
            "material_code": "JB20",
            "width_m": 1.52,
            "length_m": 2.0,
            "area_m2": round(1.52 * 2.0, 3),
            "quality_status": "GOOD",
            "storage_location": "SMOKE-OC",
            "created_reason": "smoke test manual offcut",
            "performed_by": "SMOKE-TEST",
        },
    )
    ok4 = r4.status_code == 200
    add(4, "Import OFFCUT thủ công thành công", ok4, "" if ok4 else _fail_detail(r4, "POST offcuts/import"))
    _print_row(4, "Import OFFCUT thủ công thành công", ok4, "")

    # 5 offcut no storage
    r5 = client.post(
        "/api/inventory/offcuts/import",
        json={
            "offcut_id": f"SUBLOT-SMOKE-{TS}-X",
            "material_code": "JB20",
            "width_m": 1.0,
            "length_m": 1.0,
            "quality_status": "GOOD",
            "storage_location": "",
            "created_reason": "x",
            "performed_by": "SMOKE-TEST",
        },
    )
    ok5 = r5.status_code == 400
    add(5, "Import OFFCUT thiếu storage_location phải fail", ok5, "" if ok5 else _fail_detail(r5, "POST offcuts/import no loc"))
    _print_row(5, "Import OFFCUT thiếu storage_location phải fail", ok5, "")

    # 6 Manual issue LOT success
    r6 = client.post(
        f"/api/inventory/lots/{lot_main}/manual-issue",
        json={"issue_length_m": 2.5, "reason": "smoke issue", "performed_by": "SMOKE-TEST"},
    )
    lot_after = None
    if r6.status_code == 200:
        lot_after = client.get("/api/inventory/lots", params={"q": lot_main}).json()
        lot_after = next((x for x in lot_after if x["lot_id"] == lot_main), None)
    ok6 = r6.status_code == 200 and lot_after and abs((lot_after.get("remaining_length_m") or 0) - 7.5) < 0.02
    add(6, "Manual Issue LOT thành công, remaining giảm", ok6, "" if ok6 else _fail_detail(r6, "POST manual-issue lot"))
    _print_row(6, "Manual Issue LOT thành công, remaining giảm", ok6, "")

    # 7 over issue
    r7 = client.post(
        f"/api/inventory/lots/{lot_main}/manual-issue",
        json={"issue_length_m": 9999.0, "reason": "x", "performed_by": "SMOKE-TEST"},
    )
    ok7 = r7.status_code == 400
    add(7, "Manual Issue LOT quá tồn phải fail", ok7, "" if ok7 else _fail_detail(r7, "POST manual-issue over"))
    _print_row(7, "Manual Issue LOT quá tồn phải fail", ok7, "")

    # 8 locked lot no override
    ensure_locked_lot_demo()
    r8 = client.post(
        "/api/inventory/lots/LOT-DEMO-LOCKED-001/manual-issue",
        json={"issue_length_m": 1.0, "reason": "try locked", "performed_by": "SMOKE-TEST"},
    )
    ok8 = r8.status_code == 400
    add(8, "Manual Issue LOT locked không override phải fail", ok8, "" if ok8 else _fail_detail(r8, "POST issue locked"))
    _print_row(8, "Manual Issue LOT locked không override phải fail", ok8, "")

    # 9 clear no reason
    client.post(
        "/api/inventory/lots/import",
        json={
            "lot_id": lot_nc,
            "material_code": "JB20",
            "width_m": 1.52,
            "original_length_m": 3.0,
            "remaining_length_m": 3.0,
            "storage_location": "SMOKE-RACK",
            "performed_by": "SMOKE-TEST",
        },
    )
    r9 = client.post(f"/api/inventory/lots/{lot_nc}/clear", json={"clear_mode": "WRITE_OFF_TO_ZERO", "reason": ""})
    ok9 = r9.status_code == 400
    add(9, "Clear LOT thiếu reason phải fail", ok9, "" if ok9 else _fail_detail(r9, "POST clear lot no reason"))
    _print_row(9, "Clear LOT thiếu reason phải fail", ok9, "")

    # 10 Clear LOT modes -> expected status
    ok10 = True
    detail10 = ""
    for lid, mode, expect in lot_modes:
        ri = client.post(
            "/api/inventory/lots/import",
            json={
                "lot_id": lid,
                "material_code": "JB20",
                "width_m": 1.52,
                "original_length_m": 4.0,
                "remaining_length_m": 2.0,
                "storage_location": "SMOKE-RACK",
                "performed_by": "SMOKE-TEST",
            },
        )
        if ri.status_code != 200:
            ok10 = False
            detail10 = _fail_detail(ri, f"import {lid}")
            break
        rc = client.post(
            f"/api/inventory/lots/{lid}/clear",
            json={"clear_mode": mode, "reason": f"smoke clear {mode}", "performed_by": "SMOKE-TEST"},
        )
        if rc.status_code != 200:
            ok10 = False
            detail10 = _fail_detail(rc, f"clear {lid}")
            break
        rows = client.get("/api/inventory/lots", params={"q": lid}).json()
        row = next((x for x in rows if x["lot_id"] == lid), None)
        rem = row.get("remaining_length_m") if row else None
        st = (row.get("lot_status") or row.get("status") or "").upper() if row else ""
        if rem is not None and abs(float(rem)) > 0.001:
            ok10 = False
            detail10 = f"{lid} remaining not 0: {rem}"
            break
        if expect.upper() not in st and row:
            # norm may store exact lot_status
            ls = (row.get("lot_status") or "").upper()
            if ls != expect.upper():
                ok10 = False
                detail10 = f"{lid} status want {expect} got {row.get('lot_status')}"
                break
    add(10, "Clear LOT thành công theo clear_mode", ok10, detail10)
    _print_row(10, "Clear LOT thành công theo clear_mode", ok10, detail10[:60])

    # 11 record still exists
    r11 = client.get("/api/inventory/lots", params={"q": lot_modes[0][0]}).json()
    ok11 = any(x["lot_id"] == lot_modes[0][0] for x in r11)
    add(11, "Clear LOT không xóa record", ok11, "" if ok11 else "lot missing after clear")
    _print_row(11, "Clear LOT không xóa record", ok11, "")

    # 12 offcut clear no reason
    client.post(
        "/api/inventory/offcuts/import",
        json={
            "offcut_id": oc_clear,
            "material_code": "JB20",
            "width_m": 1.0,
            "length_m": 1.0,
            "quality_status": "GOOD",
            "storage_location": "SMOKE-OC",
            "created_reason": "for clear test",
            "performed_by": "SMOKE-TEST",
        },
    )
    r12 = client.post(f"/api/inventory/offcuts/{oc_clear}/clear", json={"clear_mode": "WRITE_OFF_TO_ZERO", "reason": "  "})
    ok12 = r12.status_code == 400
    add(12, "Clear OFFCUT thiếu reason phải fail", ok12, "" if ok12 else _fail_detail(r12, "clear oc no reason"))
    _print_row(12, "Clear OFFCUT thiếu reason phải fail", ok12, "")

    # 13 clear offcut success status
    r13 = client.post(
        f"/api/inventory/offcuts/{oc_clear}/clear",
        json={"clear_mode": "MARK_AS_SCRAPPED", "reason": "smoke scrap offcut", "performed_by": "SMOKE-TEST"},
    )
    row_oc = None
    if r13.status_code == 200:
        ocs = client.get("/api/inventory/offcuts", params={"q": oc_clear}).json()
        row_oc = next((x for x in ocs if x["offcut_id"] == oc_clear), None)
    st_oc = (row_oc or {}).get("offcut_status") or (row_oc or {}).get("status") or ""
    ok13 = r13.status_code == 200 and st_oc.upper() == "SCRAPPED"
    add(13, "Clear OFFCUT thành công, status đúng", ok13, "" if ok13 else _fail_detail(r13, "clear oc"))
    _print_row(13, "Clear OFFCUT thành công, status đúng", ok13, "")

    # 14 release no reason
    ensure_locked_offcut_demo()
    r14 = client.post(
        "/api/inventory/locks/release",
        json={"source_type": "OFFCUT", "source_id": "SUBLOT-DEMO-LOCKED", "reason": ""},
    )
    ok14 = r14.status_code == 400
    add(14, "Release Lock thiếu reason phải fail", ok14, "" if ok14 else _fail_detail(r14, "release no reason"))
    _print_row(14, "Release Lock thiếu reason phải fail", ok14, "")

    # 15 release success
    r15 = client.post(
        "/api/inventory/locks/release",
        json={
            "source_type": "OFFCUT",
            "source_id": "SUBLOT-DEMO-LOCKED",
            "reason": "smoke test release",
            "performed_by": "SMOKE-TEST",
        },
    )
    oc_chk = None
    if r15.status_code == 200:
        ocs = client.get("/api/inventory/offcuts", params={"q": "SUBLOT-DEMO-LOCKED"}).json()
        oc_chk = next((x for x in ocs if x["offcut_id"] == "SUBLOT-DEMO-LOCKED"), None)
    ok15 = r15.status_code == 200 and oc_chk and oc_chk.get("is_locked") is False
    add(15, "Release Lock thành công, is_locked=false", ok15, "" if ok15 else _fail_detail(r15, "release"))
    _print_row(15, "Release Lock thành công, is_locked=false", ok15, "")

    # 16 transaction after import
    txs = client.get("/api/inventory/transactions", params={"source_id": lot_main, "transaction_type": "IMPORT_LOT"}).json()
    ok16 = isinstance(txs, list) and any(t.get("transaction_type") == "IMPORT_LOT" for t in txs)
    add(16, "Thao tác OK có inventory transaction (IMPORT_LOT)", ok16, "" if ok16 else "no IMPORT_LOT txn")
    _print_row(16, "Thao tác OK có inventory transaction (IMPORT_LOT)", ok16, "")

    # 17 audit after import
    logs = client.get("/api/audit-logs", params={"entity_id": lot_main, "action": "LOT_IMPORTED"}).json()
    ok17 = isinstance(logs, list) and any((l.get("source_id") if isinstance(l, dict) else getattr(l, "source_id", None)) == lot_main for l in logs)
    add(17, "Thao tác OK có audit LOT_IMPORTED", ok17, "" if ok17 else "no LOT_IMPORTED audit")
    _print_row(17, "Thao tác OK có audit LOT_IMPORTED", ok17, "")

    # 18 validate-sources REQ-20260604-001
    r18 = client.get("/api/inventory/validate-sources/REQ-20260604-001")
    j18 = r18.json() if r18.status_code == 200 else {}
    errs18 = [i for i in (j18.get("issues") or []) if i.get("severity") == "ERROR"]
    ok18 = r18.status_code == 200 and len(errs18) == 0
    add(18, "validate-sources REQ-20260604-001 không ERROR", ok18, "" if ok18 else f"HTTP {r18.status_code} errs={errs18!r}")
    _print_row(18, "validate-sources REQ-20260604-001 không ERROR", ok18, "")

    print("-" * 72)
    all_ok = all(x[2] for x in results)
    if all_ok:
        print("\nINVENTORY ADMIN SMOKE TEST PASSED\n")
        return 0
    print("\nINVENTORY ADMIN SMOKE TEST FAILED\n")
    for n, name, ok, det in results:
        if not ok:
            safe = f"  FAIL #{n} {name}: {det}"
            print(safe.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8", errors="replace"))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
