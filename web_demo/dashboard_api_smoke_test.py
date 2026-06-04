# -*- coding: utf-8 -*-
"""Smoke: Dashboard & related JSON APIs — không chấp nhận plain text Internal Server Error."""
import sys

from fastapi.testclient import TestClient

from database import init_db
from main import app

client = TestClient(app)
ROWS = []


def add(n, name, ok, detail=""):
    ROWS.append((n, name, ok, detail))


def main():
    init_db()
    r1 = client.get("/api/dashboard")
    ok1 = r1.status_code == 200
    add(1, "GET /api/dashboard 200", ok1, f"status={r1.status_code}")

    try:
        j1 = r1.json()
        ok2 = isinstance(j1, dict)
    except Exception as ex:
        j1 = {}
        ok2 = False
        add(2, "Response là JSON object", False, str(ex)[:200])
    else:
        add(2, "Response là JSON object", ok2, "")

    if j1.get("ok") is False and isinstance(j1.get("fallback"), dict):
        src = dict(j1["fallback"])
    else:
        src = dict(j1)

    keys = [
        "total_customers",
        "total_dealers",
        "total_vehicles",
        "manual_requests_today",
        "ocr_requests_today",
    ]
    for idx, k in enumerate(keys, start=3):
        ok = k in src
        add(idx, f"Có field {k}", ok, "" if ok else f"src_keys={list(src.keys())[:20]}")

    r8 = client.get("/api/customers/summary")
    add(8, "GET /api/customers/summary 200", r8.status_code == 200, r8.text[:120])

    r9 = client.get("/api/inventory/summary")
    add(9, "GET /api/inventory/summary 200", r9.status_code == 200, r9.text[:120])

    bad = []
    for path in ["/api/dashboard", "/api/customers/summary", "/api/inventory/summary"]:
        rr = client.get(path)
        txt = rr.text or ""
        ct = (rr.headers.get("content-type") or "").lower()
        if "application/json" not in ct and "Internal Server Error" in txt:
            bad.append(path)
    ok10 = len(bad) == 0
    add(10, "Không plain-text Internal Server Error (JSON-only)", ok10, "; ".join(bad)[:300])

    print("")
    print("| # | Case | Result | Detail |")
    print("|---:|---|:---:|---|")
    for n, name, ok, detail in ROWS:
        r = "PASS" if ok else "FAIL"
        d = (detail or "").replace("|", "\\|")[:120]
        print(f"| {n} | {name} | **{r}** | {d} |")
    print("")

    failed = [x for x in ROWS if not x[2]]
    if failed:
        for n, name, _, det in failed:
            print(f"FAIL #{n} {name}: {det}")
        print("DASHBOARD API SMOKE TEST FAILED")
        sys.exit(1)
    print("DASHBOARD API SMOKE TEST PASSED")
    sys.exit(0)


if __name__ == "__main__":
    main()
