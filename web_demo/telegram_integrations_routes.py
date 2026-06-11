# -*- coding: utf-8 -*-
"""API Telegram — chỉ Admin; không lộ token."""
from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Generator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from database import DbTelegramMessageLog, SessionLocal
from telegram_notification_service import (
    TelegramNotificationService,
    _http_send_message,
    _telegram_creds,
    _telegram_enabled,
    _log_row,
    _now_iso,
)


def _db_dep() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


integrations_router = APIRouter(prefix="/api/integrations/telegram", tags=["integrations-telegram"])
reports_router = APIRouter(prefix="/api/reports/telegram", tags=["reports-telegram"])


def _require_admin(request: Request) -> None:
    u = getattr(request.state, "auth_user", None) or {}
    if u.get("role") != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail={"error": "ADMIN_ONLY", "message": "Chỉ Admin."},
        )


@integrations_router.get("/status")
def telegram_status(request: Request):
    _require_admin(request)
    token, chat_id, gname = _telegram_creds()
    return {
        "telegram_enabled": _telegram_enabled(),
        "has_bot_token": bool(token),
        "has_group_chat_id": bool(chat_id),
        "group_display_name": gname,
        "public_base_url_configured": bool((os.environ.get("DYC_PUBLIC_BASE_URL") or "").strip()),
    }


@integrations_router.post("/test-group-message")
def telegram_test_group_message(request: Request, db: Session = Depends(_db_dep)):
    _require_admin(request)
    token, chat_id, gname = _telegram_creds()
    msg = f"🔔 DYC — kiểm tra gửi group «{gname}»\n{_now_iso()}"
    dedupe = f"TEST:{_now_iso()}"
    if not _telegram_enabled():
        _log_row(
            db,
            event_type="TEST",
            dedupe_key=dedupe,
            message_text=msg,
            send_status="SKIPPED",
            error_message="telegram_disabled",
            telegram_group_name=gname,
            telegram_chat_id=chat_id,
        )
        return {"ok": True, "send_status": "SKIPPED", "detail": "TELEGRAM_ENABLED=false"}
    if not token or not chat_id:
        _log_row(
            db,
            event_type="TEST",
            dedupe_key=dedupe,
            message_text=msg,
            send_status="SKIPPED",
            error_message="missing_token_or_chat_id",
            telegram_group_name=gname,
            telegram_chat_id=chat_id,
        )
        return {"ok": False, "send_status": "SKIPPED", "detail": "Thiếu token hoặc chat_id"}
    ok, mid, err = _http_send_message(token, chat_id, msg)
    if ok:
        _log_row(
            db,
            event_type="TEST",
            dedupe_key=dedupe,
            message_text=msg,
            send_status="SENT",
            telegram_message_id=mid,
            telegram_group_name=gname,
            telegram_chat_id=chat_id,
            sent_at=_now_iso(),
        )
        return {"ok": True, "send_status": "SENT", "telegram_message_id": mid}
    _log_row(
        db,
        event_type="TEST",
        dedupe_key=dedupe,
        message_text=msg,
        send_status="FAILED",
        error_message=err,
        telegram_group_name=gname,
        telegram_chat_id=chat_id,
    )
    return {"ok": False, "send_status": "FAILED", "detail": err}


@integrations_router.get("/message-logs")
def telegram_message_logs(
    request: Request,
    db: Session = Depends(_db_dep),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    send_status: Optional[str] = Query(None),
):
    _require_admin(request)
    q = db.query(DbTelegramMessageLog).order_by(DbTelegramMessageLog.id.desc())
    if send_status:
        q = q.filter(DbTelegramMessageLog.send_status == send_status.strip().upper())
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": r.id,
                "event_type": r.event_type,
                "request_id": r.request_id,
                "workstream_id": r.workstream_id,
                "job_card_id": r.job_card_id,
                "send_status": r.send_status,
                "dedupe_key": r.dedupe_key,
                "error_message": r.error_message,
                "telegram_message_id": r.telegram_message_id,
                "created_at": r.created_at,
                "sent_at": r.sent_at,
                "message_preview": (r.message_text or "")[:240],
            }
            for r in rows
        ],
    }


@integrations_router.post("/retry/{log_id}")
def telegram_retry_failed(request: Request, log_id: int, db: Session = Depends(_db_dep)):
    _require_admin(request)
    row = db.query(DbTelegramMessageLog).filter(DbTelegramMessageLog.id == log_id).first()
    if not row:
        raise HTTPException(404, "Log not found")
    if row.send_status != "FAILED":
        raise HTTPException(400, "Chỉ gửi lại bản ghi FAILED")
    token, chat_id, gname = _telegram_creds()
    text = row.message_text or ""
    if not _telegram_enabled() or not token or not chat_id:
        raise HTTPException(400, "Telegram chưa cấu hình hoặc đang tắt")
    ok, mid, err = _http_send_message(token, chat_id, text)
    dedupe = f"{row.dedupe_key}:manual_retry:{log_id}:{_now_iso()}"
    if ok:
        _log_row(
            db,
            event_type=row.event_type,
            dedupe_key=dedupe,
            message_text=text,
            send_status="SENT",
            telegram_message_id=mid,
            request_id=row.request_id,
            workstream_id=row.workstream_id,
            job_card_id=row.job_card_id,
            telegram_group_name=gname,
            telegram_chat_id=chat_id,
            sent_at=_now_iso(),
        )
        return {"ok": True, "send_status": "SENT", "telegram_message_id": mid}
    _log_row(
        db,
        event_type=row.event_type,
        dedupe_key=dedupe,
        message_text=text,
        send_status="FAILED",
        error_message=err,
        request_id=row.request_id,
        workstream_id=row.workstream_id,
        job_card_id=row.job_card_id,
        telegram_group_name=gname,
        telegram_chat_id=chat_id,
    )
    return {"ok": False, "send_status": "FAILED", "detail": err}


@reports_router.post("/daily")
def trigger_daily_report(request: Request):
    _require_admin(request)
    TelegramNotificationService.send_daily_report()
    return {"ok": True}


@reports_router.post("/monthly")
def trigger_monthly_report(request: Request):
    _require_admin(request)
    today = date.today()
    first_this = date(today.year, today.month, 1)
    last_prev = first_this - timedelta(days=1)
    TelegramNotificationService.send_monthly_report(last_prev.year, last_prev.month)
    return {"ok": True, "year": last_prev.year, "month": last_prev.month}


@reports_router.post("/request-completion/{request_id}")
def trigger_request_completion(request: Request, request_id: str):
    _require_admin(request)
    TelegramNotificationService.send_request_completion_report(request_id.strip())
    return {"ok": True, "request_id": request_id}
