# -*- coding: utf-8 -*-
"""Định mức phim theo dòng xe — logic dùng chung API / manual-create / OCR."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import case

from database import DbVehicleFilmNorm


def normalize_address_part(value: Optional[str]) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return re.sub(r"\s+", " ", s)


def format_street(street: Optional[str]) -> str:
    s = normalize_address_part(street)
    if not s:
        return ""
    sl = s.lower()
    street_prefixes = (
        "đường",
        "duong",
        "quốc lộ",
        "ql ",
        "ql.",
        "tỉnh lộ",
        "tl ",
        "tl.",
        "đại lộ",
        "hẻm",
        "ngõ",
        "ngách",
        "kiệt",
    )
    if any(sl.startswith(p.lower()) for p in street_prefixes):
        return s
    return f"Đường {s}"


def format_ward(ward: Optional[str]) -> str:
    w = normalize_address_part(ward)
    if not w:
        return ""
    wl = w.lower()
    ward_prefixes = ("phường", "xã", "thị trấn", "đặc khu")
    if any(wl.startswith(p) for p in ward_prefixes):
        return w
    return f"Phường {w}"


def format_province(province: Optional[str]) -> str:
    p = normalize_address_part(province)
    if not p:
        return ""
    pl = p.lower()
    if any(pl.startswith(x) for x in ("thành phố", "tp.", "tp ", "tỉnh")):
        return p
    return p


def build_full_address(
    address_no: Optional[str],
    street: Optional[str],
    ward: Optional[str],
    city: Optional[str],
) -> str:
    """
    Nối địa chỉ đầy đủ: chỉ thêm tiền tố khi chưa có — tránh 'Phường Phường', 'Đường Đường',
    không thêm tiền tố trùng cho Tỉnh/Thành phố. Đồng bộ với static/app.js (buildFullAddress).
    """
    parts: List[str] = []
    no = normalize_address_part(address_no)
    street_text = format_street(street)
    ward_text = format_ward(ward)
    city_text = format_province(city)
    if no:
        parts.append(no)
    if street_text:
        parts.append(street_text)
    if ward_text:
        parts.append(ward_text)
    if city_text:
        parts.append(city_text)
    return ", ".join(parts)


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


def build_auto_fill_items(
    db,
    norm: DbVehicleFilmNorm,
    film_type: str,
) -> List[Dict[str, Any]]:
    from material_preference_logic import resolve_material_preference

    ft = (film_type or "").strip() or (norm.film_type or "").strip() or "Phim cách nhiệt"

    def one(
        job_item: str,
        w: Optional[float],
        h: Optional[float],
        size_str: Optional[str],
    ):
        w = float(w or 0)
        h = float(h or 0)
        if w <= 0 or h <= 0:
            return None
        sz = (size_str or "").strip() or f"{int(w)}x{int(h)}"
        mp = resolve_material_preference(db, ft, job_item)
        mc = mp.get("preferred_material_code") or ""
        src = "MATERIAL_PREFERENCE" if mp.get("found") else "MISSING_PREFERENCE"
        return {
            "job_item": job_item,
            "material_code": mc,
            "material_source": src,
            "size": sz,
            "width_cm": w,
            "length_cm": h,
        }

    out: List[Dict[str, Any]] = []
    for item in (
        one("WINDSHIELD", norm.windshield_width_cm, norm.windshield_length_cm, norm.windshield_size),
        one("REAR_WINDOW", norm.rear_window_width_cm, norm.rear_window_length_cm, norm.rear_window_size),
        one("FRONT_SIDE", norm.front_side_width_cm, norm.front_side_length_cm, norm.front_side_size),
        one(
            "REAR_SIDE_TRIANGLE",
            norm.rear_side_triangle_width_cm,
            norm.rear_side_triangle_length_cm,
            norm.rear_side_triangle_size,
        ),
        one("TRIANGLE", norm.triangle_width_cm, norm.triangle_length_cm, norm.triangle_size),
        one("REAR_SIDE", norm.rear_side_width_cm, norm.rear_side_length_cm, norm.rear_side_size),
        one("SUNROOF", norm.sunroof_width_cm, norm.sunroof_length_cm, norm.sunroof_size),
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
    ft = (film_type or "").strip() or (norm.film_type or "").strip()
    return {
        "found": True,
        "norm": norm_row_to_dict(norm),
        "auto_fill_items": build_auto_fill_items(db, norm, ft),
    }


def _range_year_distance(model_year: Optional[int], range_str: Optional[str]) -> Optional[int]:
    """Khoảng cách tối thiểu từ model_year tới biên hoặc tâm khoảng năm trong chuỗi định mức."""
    if model_year is None:
        return 0
    nums = [int(x) for x in re.findall(r"\d{4}", str(range_str or ""))]
    if len(nums) >= 2:
        lo, hi = min(nums[0], nums[1]), max(nums[0], nums[1])
        if lo <= int(model_year) <= hi:
            return 0
        return min(abs(int(model_year) - lo), abs(int(model_year) - hi))
    if len(nums) == 1:
        return abs(int(model_year) - nums[0])
    return 9999


def find_nearest_active_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Optional[DbVehicleFilmNorm]:
    """Khi không khớp năm trong range, chọn bản ACTIVE gần nhất theo vehicle_model_code + film_type."""
    ft = (film_type or "").strip()
    candidates = candidate_model_codes(vehicle_model_code)
    rows = (
        db.query(DbVehicleFilmNorm)
        .filter(DbVehicleFilmNorm.status == "ACTIVE")
        .filter(DbVehicleFilmNorm.vehicle_model_code.in_(candidates))
    )
    if ft:
        rows = rows.filter(DbVehicleFilmNorm.film_type == ft)
    rows = rows.order_by(DbVehicleFilmNorm.norm_id).all()
    if not rows:
        return None
    if model_year is None:
        return rows[0]
    best: Optional[DbVehicleFilmNorm] = None
    best_d = 10**9
    for row in rows:
        d = _range_year_distance(model_year, row.model_year_range)
        if d is None:
            continue
        if d < best_d:
            best_d = d
            best = row
    return best


def resolve_vehicle_norm_with_year_fallback(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Dict[str, Any]:
    """
    Ưu tiên định mức khớp đúng model_year trong range; nếu không có thì fallback bản ACTIVE gần nhất.
    Trả thêm year_exact_match, warnings phục vụ OCR / API resolve.
    """
    vm = (vehicle_model_code or "").strip()
    ft = (film_type or "").strip() or "Phim cách nhiệt"
    warnings: List[str] = []

    norm = find_active_vehicle_norm(db, vm, model_year, ft)
    if norm:
        nft = ft or (norm.film_type or "").strip()
        return {
            "found": True,
            "year_exact_match": True,
            "norm": norm_row_to_dict(norm),
            "auto_fill_items": build_auto_fill_items(db, norm, nft),
            "warnings": warnings,
        }

    near = find_nearest_active_vehicle_norm(db, vm, model_year, ft)
    if near:
        nft = ft or (near.film_type or "").strip()
        warnings.append(
            f"Không có định mức khớp chính xác năm model; đã áp dụng norm gần nhất ({near.model_year_range})."
        )
        return {
            "found": True,
            "year_exact_match": False,
            "norm": norm_row_to_dict(near),
            "auto_fill_items": build_auto_fill_items(db, near, nft),
            "warnings": warnings,
        }

    ytxt = str(model_year) if model_year is not None else "—"
    warnings.append(f"Chưa có định mức active cho {vm} năm {ytxt}.")
    return {
        "found": False,
        "year_exact_match": False,
        "norm": None,
        "auto_fill_items": [],
        "warnings": warnings,
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
            if it.get("material_source"):
                cp["material_source"] = it.get("material_source")
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
