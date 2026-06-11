# -*- coding: utf-8 -*-
"""API báo cáo ngày — cần đăng nhập (middleware)."""
from __future__ import annotations

from typing import Generator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from daily_report_service import (
    build_daily_report,
    build_daily_report_html,
    parse_date_param,
)
from database import SessionLocal

router = APIRouter(prefix="/api/reports", tags=["reports-daily"])


def _db_dep() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/daily")
def get_daily_report(date: str = Query(..., description="YYYY-MM-DD"), db: Session = Depends(_db_dep)):
    try:
        d = parse_date_param(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return build_daily_report(db, d)


@router.get("/daily/export-html")
def export_daily_report_html(
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(_db_dep),
):
    try:
        d = parse_date_param(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    payload = build_daily_report(db, d)
    html_doc = build_daily_report_html(payload)
    fn = f"DYC_Bao_Cao_Ngay_{d.isoformat()}.html"
    return HTMLResponse(
        content=html_doc,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{fn}"',
        },
    )
