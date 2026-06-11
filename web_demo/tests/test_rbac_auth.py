# -*- coding: utf-8 -*-
"""
RBAC nhanh: cookie phiên + middleware / handler (Ma_tran_phan_quyen_DYC).
Chạy từ thư mục web_demo:  python -m pytest tests/test_rbac_auth.py -v
"""
from __future__ import annotations

import os
import sys

# Import app từ web_demo (cwd thường là web_demo khi chạy pytest tại đây)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import pytest
from fastapi.testclient import TestClient

from database import DbWorkstream, SessionLocal
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def _login(client: TestClient, username: str, password: str = "dyc123"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def test_manager_put_allocation_forbidden(client: TestClient):
    _login(client, "quanly")
    r = client.put(
        "/api/workstreams/WS-DUMMY-0000/allocation",
        json={"items": [], "change_reason": "rbac-test"},
    )
    assert r.status_code == 403
    assert r.json().get("detail") == "MANAGER_NO_ALLOCATION_WRITE"


def test_manager_post_approve_wf_materials_forbidden(client: TestClient):
    _login(client, "quanly")
    r = client.post(
        "/api/workstreams/WS-DUMMY-0000/approve-wf-materials",
        json={},
    )
    assert r.status_code == 403
    assert r.json().get("detail") == "MANAGER_NO_ALLOCATION_WRITE"


def test_technician_post_request_approve_forbidden(client: TestClient):
    _login(client, "ktv")
    r = client.post("/api/requests/REQ-DUMMY-0000/approve", json={})
    assert r.status_code == 403
    assert r.json().get("detail") == "TECHNICIAN_NO_REQUEST_APPROVE"


def test_technician_hr_write_forbidden(client: TestClient):
    _login(client, "ktv")
    r = client.post("/api/hr/teams", json={"team_name": "x", "specialty": "WF"})
    assert r.status_code == 403
    assert r.json().get("detail") == "TECHNICIAN_HR_READ_ONLY"


def test_technician_post_workstream_approve_ppf_pending_forbidden(client: TestClient):
    db = SessionLocal()
    try:
        ws = (
            db.query(DbWorkstream)
            .filter(
                DbWorkstream.workstream_type == "PPF_INSTALLATION",
                DbWorkstream.status == "PENDING_APPROVAL",
            )
            .first()
        )
    finally:
        db.close()
    if ws is None:
        pytest.skip("DB demo không có luồng PPF PENDING_APPROVAL để thử approve")

    _login(client, "ktv")
    r = client.post(f"/api/workstreams/{ws.workstream_id}/approve", json={})
    assert r.status_code == 403
    body = r.json()
    detail = body.get("detail")
    if isinstance(detail, dict):
        assert detail.get("error") == "TECHNICIAN_NO_PPF_APPROVE"
    else:
        pytest.fail(f"Unexpected body: {body}")


def test_admin_put_allocation_not_manager_rbac(client: TestClient):
    """Admin không bị middleware MANAGER_NO_ALLOCATION_WRITE (404 nếu WS không tồn tại)."""
    _login(client, "admin")
    r = client.put(
        "/api/workstreams/WS-NONEXISTENT-RBAC/allocation",
        json={"items": [], "change_reason": "rbac-test"},
    )
    assert r.status_code == 404
    assert "MANAGER_NO_ALLOCATION_WRITE" not in r.text
