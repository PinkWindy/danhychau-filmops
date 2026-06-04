# -*- coding: utf-8 -*-
"""
Import định mức phim cách nhiệt từ Excel chuẩn (Sheet1).
Cột: Loại phim, Dòng xe, Năm Model, Kính Lái, Kính Hậu, Sườn trước,
     Sườn Sau và Tam Giác, Kính Trời, Sườn Sau, Tam Giác

norm_id: NORM-XLS-{vehicle}-{year} — idempotent (ghi đè nếu đã tồn tại).
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional, Tuple

_log = logging.getLogger("uvicorn.error")

try:
    from openpyxl import load_workbook
except ImportError:
    load_workbook = None  # type: ignore


def _default_xlsx_paths() -> list[str]:
    base = os.path.dirname(os.path.abspath(__file__))
    return [
        os.path.join(base, "data", "film_norms_chuan.xlsx"),
        os.path.join(os.path.dirname(base), "Phim cách nhiệt - Định mức chuẩn.xlsx"),
    ]


def _cell_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        if v != v:  # NaN
            return ""
        if v == int(v):
            return str(int(v))
    s = str(v).strip()
    return s


def _parse_wxl(s: str) -> Tuple[str, float, float]:
    if not s or s in ("0", "0.0", "-"):
        return "", 0.0, 0.0
    m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*$", s)
    if not m:
        return s, 0.0, 0.0
    return s, float(m.group(1)), float(m.group(2))


def try_import_excel_norms(db, xlsx_path: Optional[str] = None) -> dict:
    """
    Import vào bảng vehicle_film_norms. Trả {"ok", "inserted", "updated", "skipped", "error"}.
    """
    from database import DbVehicleFilmNorm
    import datetime

    if load_workbook is None:
        return {"ok": False, "inserted": 0, "updated": 0, "skipped": 0, "error": "openpyxl chưa cài (pip install openpyxl)"}

    path = xlsx_path
    if not path:
        for p in _default_xlsx_paths():
            if os.path.isfile(p):
                path = p
                break
    if not path or not os.path.isfile(path):
        return {"ok": False, "inserted": 0, "updated": 0, "skipped": 0, "error": f"Không tìm thấy file Excel: {path}"}

    wb = load_workbook(path, read_only=True, data_only=True)
    try:
        ws = wb[wb.sheetnames[0]]
        rows = list(ws.iter_rows(values_only=True))
    finally:
        wb.close()

    if not rows:
        return {"ok": False, "error": "Sheet trống"}

    header = [str(c).strip() if c is not None else "" for c in rows[0]]
    col = {h: i for i, h in enumerate(header)}

    def idx(*names: str) -> Optional[int]:
        for n in names:
            if n in col:
                return col[n]
        return None

    i_film = idx("Loại phim")
    i_car = idx("Dòng xe")
    i_year = idx("Năm Model")
    i_ws = idx("Kính Lái")
    i_rw = idx("Kính Hậu")
    i_fs = idx("Sườn trước")
    i_sst = idx("Sườn Sau và Tam Giác")
    i_sun = idx("Kính Trời")
    i_rs = idx("Sườn Sau")
    i_tri = idx("Tam Giác")
    if i_film is None or i_car is None or i_year is None:
        return {"ok": False, "error": f"Thiếu cột bắt buộc trong header: {header}"}

    ts = datetime.datetime.utcnow().isoformat() + "Z"
    ins, upd, skip = 0, 0, 0

    for r in rows[1:]:
        if not r or all(_cell_str(c) == "" for c in r):
            skip += 1
            continue
        film = _cell_str(r[i_film]) or "Phim cách nhiệt"
        vcode = _cell_str(r[i_car]).upper().replace(" ", "")
        if not vcode:
            skip += 1
            continue
        yraw = r[i_year]
        try:
            year_int = int(float(yraw)) if yraw is not None and str(yraw).strip() != "" else None
        except (TypeError, ValueError):
            skip += 1
            continue
        if year_int is None:
            skip += 1
            continue
        myr = str(year_int)
        nid = f"NORM-XLS-{vcode}-{year_int}"

        def col_val(ci: Optional[int]) -> str:
            if ci is None or ci >= len(r):
                return ""
            return _cell_str(r[ci])

        sz_ws, w_ws, l_ws = _parse_wxl(col_val(i_ws))
        sz_rw, w_rw, l_rw = _parse_wxl(col_val(i_rw))
        sz_fs, w_fs, l_fs = _parse_wxl(col_val(i_fs))
        sz_sst, w_sst, l_sst = _parse_wxl(col_val(i_sst))
        sz_sun, w_sun, l_sun = _parse_wxl(col_val(i_sun))
        sz_rs, w_rs, l_rs = _parse_wxl(col_val(i_rs))
        sz_tri, w_tri, l_tri = _parse_wxl(col_val(i_tri))

        existing = db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.norm_id == nid).first()
        fields = dict(
            film_type=film,
            vehicle_model_code=vcode,
            model_year_range=myr,
            windshield_size=sz_ws,
            windshield_width_cm=w_ws,
            windshield_length_cm=l_ws,
            rear_window_size=sz_rw,
            rear_window_width_cm=w_rw,
            rear_window_length_cm=l_rw,
            front_side_size=sz_fs,
            front_side_width_cm=w_fs,
            front_side_length_cm=l_fs,
            rear_side_triangle_size=sz_sst,
            rear_side_triangle_width_cm=w_sst,
            rear_side_triangle_length_cm=l_sst,
            sunroof_size=sz_sun,
            sunroof_width_cm=w_sun,
            sunroof_length_cm=l_sun,
            rear_side_size=sz_rs,
            rear_side_width_cm=w_rs,
            rear_side_length_cm=l_rs,
            triangle_size=sz_tri,
            triangle_width_cm=w_tri,
            triangle_length_cm=l_tri,
            status="ACTIVE",
            updated_at=ts,
            note="Import Excel film_norms_chuan.xlsx",
        )

        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            upd += 1
        else:
            db.add(
                DbVehicleFilmNorm(
                    norm_id=nid,
                    created_at=ts,
                    **fields,
                )
            )
            ins += 1

    return {"ok": True, "inserted": ins, "updated": upd, "skipped": skip, "path": path, "error": None}
