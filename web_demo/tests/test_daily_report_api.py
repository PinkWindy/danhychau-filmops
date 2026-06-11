# -*- coding: utf-8 -*-
"""API báo cáo ngày — pytest."""
from __future__ import annotations

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import pytest
from fastapi.testclient import TestClient

from daily_report_service import build_daily_report, parse_date_param, vin_last6
from database import SessionLocal
from main import app


@pytest.fixture
def client():
    return TestClient(app)


def _login(client: TestClient, username: str = "admin", password: str = "dyc123"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r


def test_daily_report_valid_date_200(client: TestClient):
    _login(client)
    r = client.get("/api/reports/daily", params={"date": "2025-06-01"})
    assert r.status_code == 200
    data = r.json()
    assert data["report_date"] == "2025-06-01"
    assert data["previous_date"] == "2025-05-31"
    assert "kpis" in data
    assert "manager_daily_rows" in data
    assert isinstance(data["manager_daily_rows"], list)


def test_daily_report_invalid_date_400(client: TestClient):
    _login(client)
    r = client.get("/api/reports/daily", params={"date": "not-a-date"})
    assert r.status_code == 400


def test_daily_export_html_headers(client: TestClient):
    _login(client)
    r = client.get("/api/reports/daily/export-html", params={"date": "2025-06-15"})
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "text/html" in ct
    assert "utf-8" in ct
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert "DYC_Bao_Cao_Ngay_2025-06-15.html" in cd
    body = r.text
    assert "<!DOCTYPE html>" in body
    assert "DYC | Báo cáo ngày" in body or "Báo cáo ngày" in body
    assert "Theo dõi theo xe" in body


def test_daily_requires_auth(client: TestClient):
    r = client.get("/api/reports/daily", params={"date": "2025-06-01"})
    assert r.status_code == 401


def test_vin_last6_unit():
    assert vin_last6("1HGBH41JXMN109186") == "109186"


def test_build_daily_report_structure():
    db = SessionLocal()
    try:
        d = parse_date_param("2024-01-10")
        payload = build_daily_report(db, d)
    finally:
        db.close()
    assert payload["report_date"] == "2024-01-10"
    assert isinstance(payload["kpis"], dict)
    assert isinstance(payload.get("detail_rows"), list)
    assert isinstance(payload.get("manager_daily_rows"), list)
