# -*- coding: utf-8 -*-
"""
TelegramNotificationService — link, format, dedupe, TELEGRAM_ENABLED.
Chạy từ web_demo:  python -m pytest tests/test_telegram_notification_service.py -v
"""
from __future__ import annotations

import os
import sys
import uuid

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import pytest

from database import DbTelegramMessageLog, SessionLocal
from telegram_notification_service import (
    TelegramNotificationService,
    _clean_str,
    _vin_last6,
    build_dyc_link,
    format_optional_lines,
    omit_empty_sections,
)


def test_build_dyc_link_uses_public_base(monkeypatch):
    monkeypatch.setenv("DYC_PUBLIC_BASE_URL", "https://dyc.example.com")
    u = build_dyc_link("requests", request_id="REQ-1")
    assert u.startswith("https://dyc.example.com/?")
    assert "tab=requests" in u
    assert "request_id=REQ-1" in u


def test_build_dyc_link_monthly_query(monkeypatch):
    monkeypatch.setenv("DYC_PUBLIC_BASE_URL", "https://app.dyc.vn")
    u = build_dyc_link("monthly", month="2025-11")
    assert "tab=monthly" in u
    assert "month=2025-11" in u


def test_clean_str_strips_bad_tokens():
    assert _clean_str("  None  ") == ""
    assert _clean_str("unknown") == ""
    assert _clean_str("  OK  ") == "OK"


def test_vin_last_six():
    assert _vin_last6(" 1HGBH41JXMN109186 ") == "109186"
    assert _vin_last6("") == ""


def test_format_optional_lines_skips_zero_and_empty():
    lines = format_optional_lines(
        [
            ("A", 0),
            ("B", ""),
            ("C", None),
            ("D", 3),
            ("E", "hello"),
        ]
    )
    assert "A:" not in "\n".join(lines)
    assert any(l.startswith("D:") for l in lines)
    assert any(l.startswith("E:") for l in lines)


def test_omit_empty_sections_drops_blank():
    out = omit_empty_sections(
        {
            "Sec1:": ["   ", ""],
            "Sec2:": ["x"],
        }
    )
    assert "Sec1:" not in "\n".join(out)
    assert "Sec2:" in out
    assert "x" in out


def test_send_disabled_logs_skipped_no_http(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ENABLED", "false")
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_GROUP_CHAT_ID", raising=False)
    called = {"n": 0}

    def boom(*a, **k):
        called["n"] += 1
        return True, "1", None

    monkeypatch.setattr("telegram_notification_service._http_send_message", boom)
    dk = f"UNIT_SKIP:{uuid.uuid4().hex}"
    TelegramNotificationService.send_message_to_group("TEST", "msg body", dk)
    assert called["n"] == 0
    db = SessionLocal()
    try:
        row = db.query(DbTelegramMessageLog).filter(DbTelegramMessageLog.dedupe_key == dk).first()
        assert row is not None
        assert row.send_status == "SKIPPED"
    finally:
        db.close()


def test_dedupe_second_send_no_http(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ENABLED", "true")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "dummy-token")
    monkeypatch.setenv("TELEGRAM_GROUP_CHAT_ID", "-100123")
    n_http = {"n": 0}

    def fake_http(token, chat_id, text):
        n_http["n"] += 1
        return True, "42", None

    monkeypatch.setattr("telegram_notification_service._http_send_message", fake_http)
    dk = f"UNIT_DEDUPE:{uuid.uuid4().hex}"
    TelegramNotificationService.send_message_to_group("TEST", "one", dk)
    assert n_http["n"] == 1
    TelegramNotificationService.send_message_to_group("TEST", "two", dk)
    assert n_http["n"] == 1
    db = SessionLocal()
    try:
        rows = db.query(DbTelegramMessageLog).filter(DbTelegramMessageLog.dedupe_key == dk).all()
        statuses = {r.send_status for r in rows}
        assert "SENT" in statuses
        assert "SKIPPED" in statuses
    finally:
        db.close()
