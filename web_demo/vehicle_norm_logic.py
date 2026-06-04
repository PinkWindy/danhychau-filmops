# -*- coding: utf-8 -*-
"""Định mức phim theo dòng xe — logic dùng chung API / manual-create / OCR."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import case

from database import DbVehicleFilmNorm


def build_full_address(
    address_no: Optional[str],
    street: Optional[str],
    ward: Optional[str],
    city: Optional[str],
) -> str:
    """
    Nối địa chỉ đầy đủ (demo): thêm tiền tố Đường/Phường khi cần, tránh trùng từ khóa.
    Dùng chung backend + gợi ý đồng bộ với static/app.js (buildFullAddress).
    """
    chunks: List[str] = []
    an = (address_no or "").strip()
    if an:
        chunks.append(an)
    st = (street or "").strip()
    if st:
        sl = st.lower()
        if "đường" in sl:
            chunks.append(st)
        else:
            chunks.append(f"Đường {st}")
    w = (ward or "").strip()
    if w:
        wl = w.lower()
        if any(k in wl for k in ("phường", "xã", "quận", "thị trấn")):
            chunks.append(w)
        else:
            chunks.append(f"Phường {w}")
    c = (city or "").strip()
    if c:
        chunks.append(c)
    return ", ".join(chunks)


def parse_size_wxl(s: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    if not s or not str(s).strip():
        return None, None
    m = re.match(
        r"^\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*$",
        str(s).strip(),
    )
    if not m:
        return None, None
    return float(m.group(1)), float(m.group(2))


def model_year_in_range(year: Optional[int], range_str: Optional[str]) -> bool:
    if year is None:
        return True
    if not range_str:
        return True
    nums = [int(x) for x in re.findall(r"\d{4}", str(range_str))]
    if len(nums) >= 2:
        lo, hi = min(nums[0], nums[1]), max(nums[0], nums[1])
        return lo <= int(year) <= hi
    if len(nums) == 1:
        return int(year) == nums[0]
    return True


def candidate_model_codes(vehicle_model_code: str) -> List[str]:
    c = (vehicle_model_code or "").strip().upper()
    out: List[str] = []
    if c:
        out.append(c)
    if c.startswith("LEXUS_"):
        out.append(c.replace("LEXUS_", "", 1))
    if "_" in c:
        tail = c.split("_")[-1]
        if tail and tail not in out:
            out.append(tail)
    seen = set()
    uniq = []
    for x in out:
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def norm_row_to_dict(n: DbVehicleFilmNorm) -> Dict[str, Any]:
    keys = [
        "id", "norm_id", "film_type", "vehicle_model_code", "model_year_range",
        "windshield_size", "windshield_width_cm", "windshield_length_cm",
        "rear_window_size", "rear_window_width_cm", "rear_window_length_cm",
        "front_side_size", "front_side_width_cm", "front_side_length_cm",
        "rear_side_triangle_size", "rear_side_triangle_width_cm", "rear_side_triangle_length_cm",
        "triangle_size", "triangle_width_cm", "triangle_length_cm",
        "rear_side_size", "rear_side_width_cm", "rear_side_length_cm",
        "sunroof_size", "sunroof_width_cm", "sunroof_length_cm",
        "status", "created_at", "updated_at", "note",
    ]
    return {k: getattr(n, k, None) for k in keys}


def build_auto_fill_items(norm: DbVehicleFilmNorm) -> List[Dict[str, Any]]:
    def one(
        job_item: str,
        material_code: str,
        w: Optional[float],
        h: Optional[float],
        size_str: Optional[str],
    ):
        w = float(w or 0)
        h = float(h or 0)
        if w <= 0 or h <= 0:
            return None
        sz = (size_str or "").strip() or f"{int(w)}x{int(h)}"
        return {
            "job_item": job_item,
            "material_code": material_code,
            "size": sz,
            "width_cm": w,
            "length_cm": h,
        }

    out: List[Dict[str, Any]] = []
    for item in (
        one("WINDSHIELD", "RT40", norm.windshield_width_cm, norm.windshield_length_cm, norm.windshield_size),
        one("REAR_WINDOW", "JB20", norm.rear_window_width_cm, norm.rear_window_length_cm, norm.rear_window_size),
        one("FRONT_SIDE", "JB20", norm.front_side_width_cm, norm.front_side_length_cm, norm.front_side_size),
        one(
            "REAR_SIDE_TRIANGLE",
            "JB20",
            norm.rear_side_triangle_width_cm,
            norm.rear_side_triangle_length_cm,
            norm.rear_side_triangle_size,
        ),
        one("TRIANGLE", "JB20", norm.triangle_width_cm, norm.triangle_length_cm, norm.triangle_size),
        one("REAR_SIDE", "JB20", norm.rear_side_width_cm, norm.rear_side_length_cm, norm.rear_side_size),
        one("SUNROOF", "JB20", norm.sunroof_width_cm, norm.sunroof_length_cm, norm.sunroof_size),
    ):
        if item:
            out.append(item)
    return out


def find_active_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Optional[DbVehicleFilmNorm]:
    ft = (film_type or "").strip()
    candidates = candidate_model_codes(vehicle_model_code)
    q = (
        db.query(DbVehicleFilmNorm)
        .filter(DbVehicleFilmNorm.status == "ACTIVE")
        .filter(DbVehicleFilmNorm.vehicle_model_code.in_(candidates))
    )
    if ft:
        q = q.filter(DbVehicleFilmNorm.film_type == ft)
    rows = (
        q.order_by(
            case((DbVehicleFilmNorm.norm_id.like("NORM-XLS-%"), 0), else_=1),
            DbVehicleFilmNorm.norm_id,
        )
        .all()
    )
    for row in rows:
        if model_year_in_range(model_year, row.model_year_range):
            return row
    return None


def resolve_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Dict[str, Any]:
    norm = find_active_vehicle_norm(db, vehicle_model_code, model_year, film_type)
    if not norm:
        return {"found": False, "norm": None, "auto_fill_items": []}
    return {
        "found": True,
        "norm": norm_row_to_dict(norm),
        "auto_fill_items": build_auto_fill_items(norm),
    }


def sync_size_string(width_cm: Optional[float], length_cm: Optional[float], current_size: Optional[str]) -> str:
    w, h = float(width_cm or 0), float(length_cm or 0)
    if w > 0 and h > 0:
        if w == int(w) and h == int(h):
            return f"{int(w)}x{int(h)}"
        return f"{w}x{h}"
    return (current_size or "").strip()


def apply_auto_fill_to_plan(base_plan: List[dict], auto_fill: List[dict]) -> List[dict]:
    idx = {x["job_item"]: x for x in auto_fill}
    out = []
    for p in base_plan:
        cp = dict(p)
        it = idx.get(cp.get("job_item"))
        if it:
            cp["material_code"] = it.get("material_code", cp.get("material_code"))
            cp["size"] = it.get("size")
            cp["width_cm"] = it.get("width_cm")
            cp["length_cm"] = it.get("length_cm")
        out.append(cp)
    return out


def hydrate_norm_sizes_from_strings(data: dict) -> dict:
    """Nếu có *_size string mà thiếu width/length thì tách WxL."""
    pairs = [
        ("windshield", "windshield_size", "windshield_width_cm", "windshield_length_cm"),
        ("rear_window", "rear_window_size", "rear_window_width_cm", "rear_window_length_cm"),
        ("front_side", "front_side_size", "front_side_width_cm", "front_side_length_cm"),
        ("rear_side_triangle", "rear_side_triangle_size", "rear_side_triangle_width_cm", "rear_side_triangle_length_cm"),
        ("triangle", "triangle_size", "triangle_width_cm", "triangle_length_cm"),
        ("rear_side", "rear_side_size", "rear_side_width_cm", "rear_side_length_cm"),
        ("sunroof", "sunroof_size", "sunroof_width_cm", "sunroof_length_cm"),
    ]
    for _pfx, sk, wk, hk in pairs:
        wv, hv = data.get(wk), data.get(hk)
        if (not wv or not hv) and data.get(sk):
            pw, ph = parse_size_wxl(str(data.get(sk)))
            if pw is not None:
                data[wk] = pw
            if ph is not None:
                data[hk] = ph
    return data
