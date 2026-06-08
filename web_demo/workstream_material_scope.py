# -*- coding: utf-8 -*-
"""Mã vật tư theo phân bổ đã phê duyệt (WF/PPF) — không dùng full danh sách kho cho picker KTV."""
from __future__ import annotations

import json
from typing import List

from database import DbWorkstream


def approved_allocation_material_codes(ws: DbWorkstream) -> List[str]:
    """
    Trả về danh sách mã vật tư duy nhất, thứ tự ổn định, lấy từ wf_allocation_json / ppf_allocation_json
    (các hạng mục được chọn + loại PPF). Luôn gồm selected_material_code của luồng làm fallback.
    """
    out: List[str] = []

    def add(mc: object) -> None:
        m = (mc or "").strip().upper()
        if not m or m in out:
            return
        out.append(m)

    wtyp = (ws.workstream_type or "").strip()
    if wtyp == "WINDOW_FILM_INSTALLATION":
        raw = getattr(ws, "wf_allocation_json", None) or ""
        if raw.strip():
            try:
                alloc = json.loads(raw)
            except json.JSONDecodeError:
                alloc = {}
            for it in alloc.get("items") or []:
                if not isinstance(it, dict) or not it.get("is_selected"):
                    continue
                add(it.get("material_code"))
        def _add_from_wf_alloc(alloc: dict) -> None:
            for it in (alloc or {}).get("items") or []:
                if not isinstance(it, dict) or not it.get("is_selected"):
                    continue
                add(it.get("material_code"))

        raw_hist = getattr(ws, "extra_cut_history_json", None) or ""
        saw_hist = False
        if raw_hist.strip():
            try:
                hist = json.loads(raw_hist)
            except json.JSONDecodeError:
                hist = []
            if isinstance(hist, list):
                saw_hist = bool(hist)
                for ent in hist:
                    if not isinstance(ent, dict):
                        continue
                    _add_from_wf_alloc(ent.get("wf_allocation") or {})
        if not saw_hist:
            raw_ex = getattr(ws, "extra_cut_wf_allocation_json", None) or ""
            if raw_ex.strip():
                try:
                    ex_alloc = json.loads(raw_ex)
                except json.JSONDecodeError:
                    ex_alloc = {}
                _add_from_wf_alloc(ex_alloc)
        add(getattr(ws, "selected_material_code", None))
    elif wtyp == "PPF_INSTALLATION":
        raw = getattr(ws, "ppf_allocation_json", None) or ""
        if raw.strip():
            try:
                alloc = json.loads(raw)
            except json.JSONDecodeError:
                alloc = {}
            add(alloc.get("ppf_type"))
        add(getattr(ws, "selected_material_code", None))
    else:
        add(getattr(ws, "selected_material_code", None))

    if not out:
        add("JB20")
    return out
