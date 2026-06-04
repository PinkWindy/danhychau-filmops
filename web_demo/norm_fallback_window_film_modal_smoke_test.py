# -*- coding: utf-8 -*-
"""
Smoke: normalize_vehicle_model_code, norm resolve fallback, REQ-TEST-LEXUS-117,
WF allocation defaults, active-options, PUT allocation; then gọi các smoke có sẵn.
Chạy: python norm_fallback_window_film_modal_smoke_test.py
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

from database import (  # noqa: E402
    SessionLocal,
    init_db,
    DbJobCard,
    DbOcrDraft,
    DbRequest,
    DbWorkstream,
)
from main import app  # noqa: E402
from vehicle_norm_logic import normalize_vehicle_model_code  # noqa: E402

client = TestClient(app)
ROWS: list[tuple[int, str, bool, str]] = []


def add(n: int, name: str, ok: bool, detail: str = "") -> None:
    ROWS.append((n, name, ok, detail))


def _reset_lexus_117_only() -> None:
    rid = "REQ-TEST-LEXUS-117"
    did = "OCR-DRAFT-LEXUS-117-NEW"
    db = SessionLocal()
    try:
        db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete()
        db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete()
        db.query(DbRequest).filter(DbRequest.request_id == rid).delete()
        row = db.query(DbOcrDraft).filter(DbOcrDraft.ocr_draft_id == did).first()
        if row:
            row.review_status = "NEEDS_REVIEW"
            row.confirmed_by = None
            row.confirmed_at = None
            row.created_request_id = None
        db.commit()
    finally:
        db.close()


def _subrun(script: str, needle: str) -> tuple[bool, str]:
    p = subprocess.run(
        [sys.executable, script],
        cwd=str(HERE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out = (p.stdout or "") + "\n" + (p.stderr or "")
    return (p.returncode == 0 and needle in out), out[-600:]


def _put_allocation(ws_id: str, body: dict):
    b = dict(body)
    if "workstream_type" not in b:
        ws = client.get(f"/api/workstreams/{ws_id}").json()
        b["workstream_type"] = ws.get("workstream_type")
    return client.put(f"/api/workstreams/{ws_id}/allocation", json=b)


def _ensure_smoke_rx350_window_film_norm() -> None:
    """Định mức WF không còn auto-seed — đảm bảo có bản ghi RX350 cho smoke."""
    body = {
        "norm_id": "NORM-SEED-SMOKE-RX350-WF",
        "film_type": "Phim cách nhiệt",
        "vehicle_model_code": "RX350",
        "model_year_range": "2005-2030",
        "windshield_size": "90x152",
        "rear_window_size": "80x130",
        "front_side_size": "92x130",
        "rear_side_triangle_size": "50x152",
        "sunroof_size": "80x80",
        "created_by": "SMOKE-NORM-FALLBACK",
    }
    r = client.post("/api/vehicle-norms", json=body)
    if r.status_code not in (200, 409):
        raise RuntimeError(f"POST smoke norm failed: {r.status_code} {r.text[:300]}")


def main() -> int:
    init_db()
    _ensure_smoke_rx350_window_film_norm()

    add(1, 'normalize "RX350H PREMIUM CE"', normalize_vehicle_model_code("RX350H PREMIUM CE") == "RX350", "")

    r2 = client.get(
        "/api/vehicle-norms/resolve",
        params={"vehicle_model_code": "RX350", "model_year": 2026, "film_type": "Phim cách nhiệt"},
    )
    j2 = r2.json() if r2.status_code == 200 else {}
    strat2 = j2.get("resolution_strategy")
    add(2, "resolve RX350 2026 không crash", r2.status_code == 200 and j2.get("found") is True, strat2 or "")
    add(
        3,
        "RX350 2026 strategy EXACT hoặc fallback hợp lệ",
        r2.status_code == 200
        and strat2 in ("EXACT_YEAR", "LATEST_PRIOR_YEAR", "LATEST_AVAILABLE_YEAR"),
        strat2 or "",
    )
    if strat2 == "EXACT_YEAR":
        add(4, "strategy EXACT_YEAR khi DB khớp năm", True, "")
    else:
        add(
            4,
            "strategy fallback năm (PRIOR/AVAILABLE)",
            strat2 in ("LATEST_PRIOR_YEAR", "LATEST_AVAILABLE_YEAR"),
            strat2 or "",
        )

    r5 = client.get(
        "/api/vehicle-norms/resolve",
        params={"vehicle_model_code": "RX350", "model_year": 1900, "film_type": "Phim cách nhiệt"},
    )
    j5 = r5.json() if r5.status_code == 200 else {}
    st5 = j5.get("resolution_strategy")
    add(
        5,
        "model_year rất cũ → fallback không crash",
        r5.status_code == 200 and j5.get("found") is True and st5 != "NOT_FOUND",
        st5 or "",
    )

    _reset_lexus_117_only()
    client.post("/api/test-data/lexus-ocr-drafts")
    r6 = client.post("/api/ocr/OCR-DRAFT-LEXUS-117-NEW/confirm", json={})
    j6 = r6.json() if r6.status_code == 200 else {}
    add(6, "Confirm OCR 117 → REQ-TEST-LEXUS-117", r6.status_code == 200 and j6.get("request_id") == "REQ-TEST-LEXUS-117", "")

    r7 = client.get("/api/requests/REQ-TEST-LEXUS-117")
    q7 = r7.json() if r7.status_code == 200 else {}
    sc = (q7.get("sales_consultant") or "").strip()
    add(7, "REQ-117 có sales_consultant", r7.status_code == 200 and len(sc) >= 2, sc[:80])

    na = q7.get("norm_application") or {}
    if not na and q7.get("norm_application_json"):
        try:
            na = json.loads(q7["norm_application_json"])
        except json.JSONDecodeError:
            na = {}
    norm_ok = bool(na.get("found")) and na.get("resolution_strategy") != "NOT_FOUND"
    add(8, "REQ-117 norm resolve found (RX350)", norm_ok, json.dumps({k: na.get(k) for k in ("found", "resolution_strategy", "norm_id")}, ensure_ascii=False))

    wss = client.get("/api/requests/REQ-TEST-LEXUS-117/workstreams").json()
    wf = next((w for w in wss if w.get("workstream_type") == "WINDOW_FILM_INSTALLATION"), None)
    wf_id = (wf or {}).get("workstream_id")
    wfa = (wf or {}).get("wf_allocation") or {}
    if isinstance(wfa, str):
        try:
            wfa = json.loads(wfa)
        except json.JSONDecodeError:
            wfa = {}
    items = {x.get("item_code"): x for x in (wfa.get("items") or [])}

    def _chk(code: str, n: int, label: str) -> None:
        it = items.get(code) or {}
        add(n, label, bool(it.get("is_selected")) and int(it.get("quantity") or 0) >= 1, json.dumps(it, ensure_ascii=False)[:200])

    _chk("WINDSHIELD", 9, "WF default WINDSHIELD selected qty>=1")
    _chk("REAR_WINDOW", 10, "WF default REAR_WINDOW selected qty>=1")
    _chk("FRONT_SIDE", 11, "WF default FRONT_SIDE selected qty>=1")
    _chk("REAR_SIDE_TRIANGLE", 12, "WF default REAR_SIDE_TRIANGLE selected qty>=1")

    def _dims(code: str) -> tuple[float, float, str]:
        it = items.get(code) or {}
        return (
            float(it.get("required_width_cm") or 0),
            float(it.get("required_length_cm") or 0),
            (it.get("planned_size") or "").strip(),
        )

    w1, l1, s1 = _dims("WINDSHIELD")
    add(13, "WINDSHIELD size từ norm (cm > 0)", w1 > 0 and l1 > 0 and bool(s1), f"{s1} {w1}x{l1}")
    w2, l2, s2 = _dims("REAR_WINDOW")
    add(14, "REAR_WINDOW có kích thước", w2 > 0 and l2 > 0, s2)
    w3, l3, s3 = _dims("FRONT_SIDE")
    add(15, "FRONT_SIDE có kích thước", w3 > 0 and l3 > 0, s3)
    w4, l4, s4 = _dims("REAR_SIDE_TRIANGLE")
    add(16, "REAR_SIDE_TRIANGLE có kích thước", w4 > 0 and l4 > 0, s4)

    add(
        17,
        "WINDSHIELD material RT40 (preference)",
        (items.get("WINDSHIELD") or {}).get("material_code", "").upper() == "RT40",
        (items.get("WINDSHIELD") or {}).get("material_code"),
    )
    add(
        18,
        "REAR_WINDOW material JB20 (preference)",
        (items.get("REAR_WINDOW") or {}).get("material_code", "").upper() == "JB20",
        (items.get("REAR_WINDOW") or {}).get("material_code"),
    )

    mc_rt = (items.get("WINDSHIELD") or {}).get("material_code") or "RT40"
    r19 = client.get(
        "/api/inventory/lots/active-options",
        params={"material_code": mc_rt, "request_id": "REQ-TEST-LEXUS-117", "min_length_m": 0.5, "min_width_m": 0.5},
    )
    j19 = r19.json() if r19.status_code == 200 else {}
    add(19, "lots/active-options theo material_code", r19.status_code == 200 and isinstance(j19.get("items"), list), f"count={len(j19.get('items') or [])}")

    r20 = client.get(
        "/api/inventory/offcuts/active-options",
        params={"material_code": "JB20", "request_id": "REQ-TEST-LEXUS-117"},
    )
    j20 = r20.json() if r20.status_code == 200 else {}
    add(20, "offcuts/active-options JB20 (list)", r20.status_code == 200, f"count={len(j20.get('items') or [])}")

    put_body = json.loads(json.dumps(wfa))
    put_body["change_reason"] = ""
    r21 = _put_allocation(wf_id, put_body)
    add(21, "PUT WF allocation default OK", r21.status_code == 200, str(r21.json())[:120])

    ok22, tail22 = _subrun("workstream_allocation_common_smoke_test.py", "WORKSTREAM ALLOCATION COMMON SMOKE TEST PASSED")
    add(22, "workstream_allocation_common_smoke_test.py", ok22, tail22[-200:])

    # database_seed_integrity_smoke_test.py yêu cầu audit DATABASE_RESET_SEEDED (chỉ có sau reset chuẩn);
    # chạy riêng: python database_seed_integrity_smoke_test.py sau POST /api/admin/reset-database-standard-seed.

    print("")
    print("| # | Case | Result | Detail |")
    print("|---:|---|:---:|---|")
    for n, name, ok, detail in sorted(ROWS, key=lambda x: x[0]):
        r = "PASS" if ok else "FAIL"
        d = (detail or "").replace("|", "\\|")[:100]
        print(f"| {n} | {name} | **{r}** | {d} |")
    print("")

    if not all(x[2] for x in ROWS):
        print("NORM FALLBACK & WINDOW FILM MODAL SMOKE TEST FAILED")
        return 1
    print("NORM FALLBACK & WINDOW FILM MODAL SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
