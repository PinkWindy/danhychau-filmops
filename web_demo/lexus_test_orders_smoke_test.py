# -*- coding: utf-8 -*-
"""Smoke: Lexus OCR test drafts + confirm → REQ-TEST-LEXUS-* (WF only)."""
import json
import sys

from fastapi.testclient import TestClient
from database import SessionLocal, init_db, DbJobCard, DbOcrDraft, DbRequest, DbWorkstream
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
    import os
    import subprocess

    d = os.path.dirname(__file__)
    p = subprocess.run([sys.executable, script], cwd=d, capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = p.returncode == 0 and expect_line in (p.stdout or "")
    return ok, (p.stderr or p.stdout or "")[-500:]


def _reset_lexus_demo():
    db = SessionLocal()
    try:
        for rid in ("REQ-TEST-LEXUS-115", "REQ-TEST-LEXUS-117"):
            db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete()
            db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete()
            db.query(DbRequest).filter(DbRequest.request_id == rid).delete()
        for did in ("OCR-DRAFT-LEXUS-115-NEW", "OCR-DRAFT-LEXUS-117-NEW"):
            row = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == did).first()
            if row:
                row.review_status = "NEEDS_REVIEW"
                row.confirmed_by = None
                row.confirmed_at = None
                row.created_request_id = None
        db.commit()
    finally:
        db.close()


def main():
    init_db()
    _reset_lexus_demo()

    r1 = client.post("/api/test-data/lexus-ocr-drafts")
    j1 = r1.json() if r1.status_code == 200 else {}
    add(1, "POST lexus-ocr-drafts 200", r1.status_code == 200, str(j1)[:100])

    r2 = client.post("/api/test-data/lexus-ocr-drafts")
    j2 = r2.json() if r2.status_code == 200 else {}
    ok2 = r2.status_code == 200 and j2.get("already_existed") is True
    add(2, "POST lần 2 không trùng (already_existed)", ok2, str(j2)[:100])

    r3 = client.get("/api/ocr-drafts")
    j3 = r3.json() if r3.status_code == 200 else []
    ids3 = [x.get("ocr_draft_id") for x in j3]
    add(3, "GET ocr-drafts có LEXUS-115", r3.status_code == 200 and "OCR-DRAFT-LEXUS-115-NEW" in ids3, "")

    add(4, "GET ocr-drafts có LEXUS-117", r3.status_code == 200 and "OCR-DRAFT-LEXUS-117-NEW" in ids3, "")

    r5 = client.post("/api/ocr/OCR-DRAFT-LEXUS-115-NEW/confirm", json={})
    j5 = r5.json() if r5.status_code == 200 else {}
    add(5, "Confirm 115 → REQ-TEST-LEXUS-115", r5.status_code == 200 and j5.get("request_id") == "REQ-TEST-LEXUS-115", r5.text[:160])

    r6 = client.post("/api/ocr/OCR-DRAFT-LEXUS-117-NEW/confirm", json={})
    j6 = r6.json() if r6.status_code == 200 else {}
    add(6, "Confirm 117 → REQ-TEST-LEXUS-117", r6.status_code == 200 and j6.get("request_id") == "REQ-TEST-LEXUS-117", r6.text[:160])

    r7 = client.get("/api/requests/REQ-TEST-LEXUS-115/workstreams")
    w7 = r7.json() if r7.status_code == 200 else []
    types7 = [x.get("workstream_type") for x in w7]
    add(7, "115 có WINDOW_FILM_INSTALLATION", r7.status_code == 200 and "WINDOW_FILM_INSTALLATION" in types7, str(types7))

    r8 = client.get("/api/requests/REQ-TEST-LEXUS-117/workstreams")
    w8 = r8.json() if r8.status_code == 200 else []
    types8 = [x.get("workstream_type") for x in w8]
    add(8, "117 có WINDOW_FILM_INSTALLATION", r8.status_code == 200 and "WINDOW_FILM_INSTALLATION" in types8, str(types8))

    ok9 = True
    for rid in ("REQ-TEST-LEXUS-115", "REQ-TEST-LEXUS-117"):
        wss = client.get(f"/api/requests/{rid}/workstreams").json()
        for ws in wss:
            if ws.get("status") == "APPROVED":
                ok9 = False
    add(9, "Không WS nào tự APPROVED sau confirm", ok9, "")

    r10a = client.get("/api/requests/REQ-TEST-LEXUS-115").json()
    r10b = client.get("/api/requests/REQ-TEST-LEXUS-117").json()
    ok10 = "+07:00" in str(r10a.get("requested_delivery_time", "")) and "+07:00" in str(
        r10b.get("requested_delivery_time", "")
    )
    add(10, "requested_delivery_at ISO +07", ok10, str(r10a.get("requested_delivery_time"))[:40])

    ok11 = (
        len(str(r10a.get("customer_name", "")).strip()) >= 3
        and len(str(r10b.get("customer_name", "")).strip()) >= 3
        and "MASKED" not in str(r10a.get("customer_name", "")).upper()
        and "MASKED" not in str(r10b.get("customer_name", "")).upper()
    )
    add(11, "customer_name demo đầy đủ (không MASKED)", ok11, "")

    def _vin_len(r):
        v = (r.get("vin_number") or r.get("vin_masked") or "").strip()
        return len(v)

    ok12 = _vin_len(r10a) >= 17 and _vin_len(r10b) >= 17 and "MASKED" not in str(
        r10a.get("vin_number", "") + r10a.get("vin_masked", "")
    ).upper()
    add(12, "VIN 17 ký tự demo (không MASKED)", ok12, "")

    na115 = r10a.get("norm_application") or {}
    if not na115 and r10a.get("norm_application_json"):
        try:
            na115 = json.loads(r10a["norm_application_json"])
        except Exception:
            na115 = {}
    norm_ok = na115.get("found") is True
    needs115 = (r10a.get("status") or "") == "NEEDS_REVIEW"
    warn115 = (na115.get("warning") or "") + "".join(na115.get("warnings") or [])
    ok13 = norm_ok or (needs115 and ("NO_VEHICLE" in str(r10a.get("exception_reason", "")) or "định mức" in warn115.lower()))
    add(13, "Norm auto-fill hoặc NEEDS_REVIEW + cảnh báo", ok13, str(na115.get("found")))

    svc115 = {}
    try:
        svc115 = json.loads(r10a.get("service_selection_json") or "{}")
    except Exception:
        pass
    miss_pref = "MISSING_MATERIAL_PREF" in str(r10a.get("exception_reason", ""))
    ok14 = r10a.get("status") == "ALLOCATED" or (r10a.get("status") == "NEEDS_REVIEW" and miss_pref)
    add(14, "Material preference hoặc NEEDS_REVIEW", ok14, r10a.get("status", ""))

    r15a = client.get("/api/inventory/validate-sources/REQ-TEST-LEXUS-115")
    r15b = client.get("/api/inventory/validate-sources/REQ-TEST-LEXUS-117")
    j15a = r15a.json() if r15a.status_code == 200 else []
    j15b = r15b.json() if r15b.status_code == 200 else []
    bad15 = False
    for arr in (j15a, j15b):
        if not isinstance(arr, list):
            continue
        for it in arr:
            if isinstance(it, dict) and it.get("severity") == "ERROR":
                bad15 = True
    add(15, "validate-sources không ERROR bất thường", r15a.status_code == 200 and r15b.status_code == 200 and not bad15, str(j15a)[:80])

    ok16, det16 = _subrun("material_preference_manual_order_smoke_test.py", "MATERIAL PREFERENCE & MANUAL ORDER SMOKE TEST PASSED")
    add(16, "material_preference_manual_order_smoke_test.py", ok16, det16[-120:])

    ok17, det17 = _subrun("manual_order_customer_smoke_test.py", "MANUAL ORDER & CUSTOMER MANAGEMENT SMOKE TEST PASSED")
    add(17, "manual_order_customer_smoke_test.py", ok17, det17[-120:])

    ok18, det18 = _subrun("inventory_admin_smoke_test.py", "INVENTORY ADMIN SMOKE TEST PASSED")
    add(18, "inventory_admin_smoke_test.py", ok18, det18[-120:])

    _print_table()
    failed = [x for x in ROWS if not x[2]]
    if failed:
        for n, name, _, det in failed:
            print(f"FAIL #{n} {name}: {det}")
        sys.exit(1)
    print("LEXUS TEST ORDERS SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
