# -*- coding: utf-8 -*-
"""
Chụp screenshot thật modal phân bổ chung (PPF + Window Film).
Chạy: từ thư mục web_demo — python audit/capture_allocation_modal_screenshots.py

Yêu cầu: pip install playwright && python -m playwright install chromium
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request

WEB_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
REQ_ID = "REQ-SCREEN-ALLOC-MODAL"
SHOT_DIR = os.path.join(WEB_ROOT, "audit", "screenshots")
PORT = 9788


def _seed_modal_request():
    os.chdir(WEB_ROOT)
    sys.path.insert(0, WEB_ROOT)
    from database import SessionLocal, init_db

    init_db()
    from workstream_allocation_common_smoke_test import _ensure_multi_ws

    db = SessionLocal()
    try:
        rid, ppf_id, wf_id, *_ = _ensure_multi_ws(db, REQ_ID)
        return rid, ppf_id, wf_id
    finally:
        db.close()


def _wait_http(url: str, timeout_s: float = 45.0) -> None:
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except OSError:
            time.sleep(0.4)
    raise RuntimeError(f"Server không phản hồi: {url}")


def main() -> int:
    os.makedirs(SHOT_DIR, exist_ok=True)
    rid, ppf_id, wf_id = _seed_modal_request()

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=WEB_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{PORT}"
    try:
        _wait_http(f"{base}/")

        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1400, "height": 900})
            page = context.new_page()
            page.goto(f"{base}/", wait_until="networkidle", timeout=60000)
            page.locator('[data-tab="requests"]').click()
            page.wait_for_timeout(600)
            page.evaluate("(rid) => { if (typeof window.chonDon === 'function') window.chonDon(rid); }", REQ_ID)
            page.wait_for_function(
                "(rid) => document.getElementById('board-req-title') && document.getElementById('board-req-title').textContent.includes(rid)",
                arg=REQ_ID,
                timeout=20000,
            )
            page.wait_for_timeout(800)

            # PPF modal
            page.evaluate("async (wsid) => { await window.chiinhSuaWs(wsid); }", ppf_id)
            page.wait_for_selector("#ws-edit-modal", state="visible", timeout=20000)
            page.wait_for_timeout(500)
            page.locator("#ws-edit-modal").screenshot(path=os.path.join(SHOT_DIR, "modal-ppf-allocation-common-real.png"))
            page.locator("#btn-x-ws-edit").click()
            page.wait_for_timeout(400)

            # Window Film modal
            page.evaluate("async (wsid) => { await window.chiinhSuaWs(wsid); }", wf_id)
            page.wait_for_selector("#ws-edit-modal", state="visible", timeout=20000)
            page.wait_for_timeout(500)
            page.locator("#ws-edit-modal").screenshot(
                path=os.path.join(SHOT_DIR, "modal-window-film-allocation-common-real.png")
            )

            # Dropdown LOT (cột nguồn — select LOT trong WF)
            src_sel = page.locator("#ws-edit-modal select.wa-src-id").first
            if src_sel.count():
                src_sel.click()
                page.wait_for_timeout(300)
                page.locator("#ws-edit-modal").screenshot(path=os.path.join(SHOT_DIR, "allocation-lot-active-options-real.png"))

            typ = page.locator("#ws-edit-modal select.wa-src-type").first
            if typ.count():
                typ.select_option("OFFCUT")
                page.wait_for_timeout(400)
                page.locator("#ws-edit-modal").screenshot(path=os.path.join(SHOT_DIR, "allocation-offcut-active-options-real.png"))

            page.locator("#btn-x-ws-edit").click()
            browser.close()

        print("OK — screenshots:")
        for n in (
            "modal-ppf-allocation-common-real.png",
            "modal-window-film-allocation-common-real.png",
            "allocation-lot-active-options-real.png",
            "allocation-offcut-active-options-real.png",
        ):
            p = os.path.join(SHOT_DIR, n)
            print(" ", p, "exists" if os.path.isfile(p) else "MISSING")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
