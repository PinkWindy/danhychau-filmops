# -*- coding: utf-8 -*-
"""API đọc danh mục địa bàn từ static/location_master.json (không bắt buộc runtime)."""
import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

_log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/location", tags=["location"])


def _web_demo_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def _master_json_path() -> str:
    return os.path.join(_web_demo_dir(), "static", "location_master.json")


def load_location_master() -> Optional[Dict[str, Any]]:
    path = _master_json_path()
    if not os.path.isfile(path):
        _log.warning("location_master.json không có tại %s — API trả rỗng.", path)
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _log.warning("Đọc location_master.json lỗi: %s", e)
        return None


def register_location_routes(app):
    @router.get("/provinces")
    def list_provinces():
        raw = load_location_master()
        if not raw or not isinstance(raw.get("data"), dict):
            return {"items": [], "total": 0}
        items = sorted(raw["data"].keys(), key=lambda s: (s.lower(), s))
        return {"items": items, "total": len(items)}

    @router.get("/wards")
    def list_wards(province: Optional[str] = Query(None)):
        p = (province or "").strip()
        if not p:
            return {"province": "", "items": [], "total": 0}
        raw = load_location_master()
        if not raw or not isinstance(raw.get("data"), dict):
            return {"province": p, "items": [], "total": 0}
        wards = raw["data"].get(p)
        if not wards:
            # Khớp không phân biệt hoa thường
            for k, v in raw["data"].items():
                if k.strip().lower() == p.lower():
                    wards = v
                    p = k
                    break
        if not wards:
            return {"province": p, "items": [], "total": 0}
        items = list(wards) if isinstance(wards, list) else list(wards)
        items = sorted(items, key=lambda s: (s.lower(), s))
        return {"province": p, "items": items, "total": len(items)}

    app.include_router(router)
