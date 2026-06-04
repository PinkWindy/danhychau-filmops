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
    rs = str(range_str).strip()
    if rs.upper() == "ALL":
        return True
    nums = [int(x) for x in re.findall(r"\d{4}", str(range_str))]
    if len(nums) >= 2:
        lo, hi = min(nums[0], nums[1]), max(nums[0], nums[1])
        return lo <= int(year) <= hi
    if len(nums) == 1:
        return int(year) == nums[0]
    return True


def normalize_vehicle_model_code(value: Optional[str]) -> str:
    """
    Chuẩn hóa mã dòng xe để khớp bảng định mức (RX350, ES250, …).
    Ví dụ: RX350H PREMIUM CE → RX350, LEXUS_RX350 → RX350, LM500H → LM500.
    """
    if value is None:
        return ""
    raw = str(value).strip().upper()
    if not raw:
        return ""
    s = raw.replace(" ", "_")
    while "__" in s:
        s = s.replace("__", "_")
    if s.startswith("LEXUS_"):
        s = s[len("LEXUS_") :]
    # Lấy segment đầu có dạng chữ+số (bỏ mô tả marketing sau dấu _)
    if "_" in s:
        parts = [p for p in s.split("_") if p]
        hit = next((p for p in parts if re.match(r"^[A-Z]{2,12}\d{2,4}", p)), None)
        if hit:
            s = hit
        else:
            s = parts[0]
    m = re.match(r"^([A-Z]{2,12})(\d{2,4})(H|PHEV|HYBRID)?$", s)
    if m:
        letters, digits, suf = m.group(1), m.group(2), (m.group(3) or "")
        if suf == "H":
            return f"{letters}{digits}"
        return f"{letters}{digits}"
    m2 = re.match(r"^([A-Z]{2,12})(\d{2,4})$", s)
    if m2:
        return m2.group(1) + m2.group(2)
    return s


def parse_norm_year_bounds(range_str: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    """Trả (lo, hi) từ model_year_range; (None, None) = không giới hạn năm (ALL / rỗng)."""
    if not range_str:
        return None, None
    rs = str(range_str).strip().upper()
    if not rs or rs == "ALL":
        return None, None
    nums = [int(x) for x in re.findall(r"\d{4}", str(range_str))]
    if len(nums) >= 2:
        return min(nums[0], nums[1]), max(nums[0], nums[1])
    if len(nums) == 1:
        return nums[0], nums[0]
    return None, None


def _year_in_norm_bounds(y: int, lo: Optional[int], hi: Optional[int]) -> bool:
    if lo is None and hi is None:
        return True
    if lo is None:
        return y <= (hi if hi is not None else y)
    if hi is None:
        return y >= lo
    return lo <= y <= hi


def candidate_model_codes(vehicle_model_code: str) -> List[str]:
    c = (vehicle_model_code or "").strip().upper()
    out: List[str] = []
    if c:
        out.append(c)
    if c.startswith("LEXUS_"):
        tail = c.replace("LEXUS_", "", 1)
        if tail and tail not in out:
            out.append(tail)
    elif re.match(r"^[A-Z]{2,12}\d", c):
        lx = f"LEXUS_{c}"
        if lx not in out:
            out.append(lx)
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


def _query_active_norms_for_models(db: Session, vehicle_model_code: str, film_type: str) -> List[DbVehicleFilmNorm]:
    ft = (film_type or "").strip()
    candidates = list(candidate_model_codes(vehicle_model_code))
    if ft.upper() == "PPF" or "PPF" in ft.upper():
        if "ALL" not in candidates:
            candidates.append("ALL")
    q = (
        db.query(DbVehicleFilmNorm)
        .filter(DbVehicleFilmNorm.status == "ACTIVE")
        .filter(DbVehicleFilmNorm.vehicle_model_code.in_(candidates))
    )
    if ft and not (ft.upper() == "PPF" or "PPF" in ft.upper()):
        q = q.filter(DbVehicleFilmNorm.film_type == ft)
    return (
        q.order_by(
            case((DbVehicleFilmNorm.norm_id.like("NORM-XLS-%"), 0), else_=1),
            DbVehicleFilmNorm.norm_id,
        ).all()
    )


def select_vehicle_norm_with_year_strategy(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Tuple[Optional[DbVehicleFilmNorm], str, Optional[int], Optional[str], Optional[str]]:
    """
    Chọn định mức ACTIVE theo: exact năm → năm hiệu lực gần nhất ≤ requested → năm sẵn có gần nhất > requested.
    Trả (norm_row, resolution_strategy, model_year_resolved, warning_vn, vehicle_model_code_used).
    """
    vm_in = (vehicle_model_code or "").strip()
    vm = normalize_vehicle_model_code(vm_in) or vm_in.upper()
    ft = (film_type or "").strip() or "Phim cách nhiệt"
    rows = _query_active_norms_for_models(db, vm, ft)
    parsed: List[Tuple[DbVehicleFilmNorm, Optional[int], Optional[int]]] = []
    for r in rows:
        lo, hi = parse_norm_year_bounds(r.model_year_range)
        parsed.append((r, lo, hi))
    if not parsed:
        return None, "NOT_FOUND", None, None, vm

    Y = int(model_year) if model_year is not None else None

    def _pick_max_hi(cands: List[Tuple[DbVehicleFilmNorm, Optional[int], Optional[int]]]) -> Optional[DbVehicleFilmNorm]:
        best = None
        best_key: Optional[Tuple[int, str]] = None
        for r, lo, hi in cands:
            eff_hi = hi if hi is not None else (lo if lo is not None else -10**9)
            key = (eff_hi, r.norm_id or "")
            if best_key is None or key > best_key:
                best_key = key
                best = r
        return best

    def _pick_min_lo(cands: List[Tuple[DbVehicleFilmNorm, Optional[int], Optional[int]]]) -> Optional[DbVehicleFilmNorm]:
        best = None
        best_key: Optional[Tuple[int, str]] = None
        for r, lo, hi in cands:
            eff_lo = lo if lo is not None else (hi if hi is not None else 10**9)
            key = (eff_lo, r.norm_id or "")
            if best_key is None or key < best_key:
                best_key = key
                best = r
        return best

    if Y is None:
        all_bounds = [(r, lo, hi) for r, lo, hi in parsed if lo is None and hi is None]
        if all_bounds:
            ch = _pick_max_hi(all_bounds)
            return ch, "EXACT_YEAR", None, None, vm
        ch2 = _pick_max_hi(parsed)
        lo2, hi2 = next(((lo, hi) for r, lo, hi in parsed if r.norm_id == ch2.norm_id), (None, None))
        yr = hi2 or lo2
        return ch2, "LATEST_AVAILABLE_YEAR", yr, None, vm

    exact = [(r, lo, hi) for r, lo, hi in parsed if _year_in_norm_bounds(Y, lo, hi)]
    if exact:
        ch = _pick_max_hi(exact)
        return ch, "EXACT_YEAR", Y, None, vm

    prior = [(r, lo, hi) for r, lo, hi in parsed if hi is not None and hi <= Y]
    if prior:
        ch = _pick_max_hi(prior)
        lo3, hi3 = next(((lo, hi) for r, lo, hi in parsed if r.norm_id == ch.norm_id), (None, None))
        yr_res = hi3
        warn = (
            f"Không có định mức năm {Y}, đang dùng định mức mới nhất trong các bản có hiệu lực đến năm {yr_res}."
            if yr_res is not None
            else f"Không có định mức năm {Y}, đang dùng định mức gần nhất."
        )
        return ch, "LATEST_PRIOR_YEAR", yr_res, warn, vm

    future = [(r, lo, hi) for r, lo, hi in parsed if lo is not None and lo > Y]
    if future:
        ch = _pick_min_lo(future)
        lo4, _hi4 = next(((lo, hi) for r, lo, hi in parsed if r.norm_id == ch.norm_id), (None, None))
        warn = f"Không có định mức cho năm {Y} trở về trước; đang dùng bản có hiệu lực từ năm {lo4}."
        return ch, "LATEST_AVAILABLE_YEAR", lo4, warn, vm

    ch = _pick_max_hi(parsed)
    lo5, hi5 = next(((lo, hi) for r, lo, hi in parsed if r.norm_id == ch.norm_id), (None, None))
    yr5 = hi5 or lo5
    warn = f"Không có định mức active khớp năm {Y}; đang dùng bản catalog gần nhất (năm tham chiếu {yr5})."
    return ch, "LATEST_AVAILABLE_YEAR", yr5, warn, vm


def find_active_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Optional[DbVehicleFilmNorm]:
    vm = normalize_vehicle_model_code(vehicle_model_code) or (vehicle_model_code or "").strip().upper()
    row, strat, _yr, _w, _vmu = select_vehicle_norm_with_year_strategy(db, vm, model_year, film_type)
    if strat == "NOT_FOUND":
        return None
    return row


def find_nearest_active_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Optional[DbVehicleFilmNorm]:
    """Giữ tên hàm — ủy quyền cho select_vehicle_norm_with_year_strategy."""
    vm = normalize_vehicle_model_code(vehicle_model_code) or (vehicle_model_code or "").strip().upper()
    row, strat, _, _, _ = select_vehicle_norm_with_year_strategy(db, vm, model_year, film_type)
    return row if strat != "NOT_FOUND" else None


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


def resolve_vehicle_norm(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Dict[str, Any]:
    full = resolve_vehicle_norm_with_year_fallback(db, vehicle_model_code, model_year, film_type)
    return {
        "found": full.get("found"),
        "norm_id": full.get("norm_id"),
        "norm": full.get("norm"),
        "auto_fill_items": full.get("auto_fill_items") or [],
    }


def resolve_vehicle_norm_with_year_fallback(
    db: Session,
    vehicle_model_code: str,
    model_year: Optional[int],
    film_type: str,
) -> Dict[str, Any]:
    """
    Resolve định mức theo vehicle_model_code (đã normalize), fallback năm theo business rule.
    """
    raw_in = (vehicle_model_code or "").strip()
    ft = (film_type or "").strip() or "Phim cách nhiệt"
    warnings: List[str] = []
    norm, strategy, yr_res, warn_one, vm_used = select_vehicle_norm_with_year_strategy(
        db, raw_in, model_year, ft
    )
    if warn_one:
        warnings.append(warn_one)
    if not norm:
        ytxt = str(model_year) if model_year is not None else "—"
        wnf = (
            "Chưa có định mức active cho dòng xe/năm model này. "
            "Vui lòng cập nhật Hồ sơ xe > Định mức phim."
        )
        warnings.append(wnf)
        return {
            "found": False,
            "norm_id": None,
            "year_exact_match": False,
            "norm": None,
            "auto_fill_items": [],
            "warnings": warnings,
            "vehicle_model_code_raw": raw_in,
            "vehicle_model_code_requested": vm_used,
            "model_year_requested": model_year,
            "model_year_resolved": None,
            "resolution_strategy": "NOT_FOUND",
            "warning": wnf,
        }

    nft = ft or (norm.film_type or "").strip() or "Phim cách nhiệt"
    norm_dict = norm_row_to_dict(norm)
    out_warn = warn_one if strategy != "EXACT_YEAR" else None
    if out_warn:
        warnings = [w for w in warnings if w]
    return {
        "found": True,
        "norm_id": norm_dict.get("norm_id"),
        "year_exact_match": strategy == "EXACT_YEAR",
        "norm": norm_dict,
        "auto_fill_items": build_auto_fill_items(db, norm, nft),
        "warnings": [w for w in warnings if w],
        "vehicle_model_code_raw": raw_in,
        "vehicle_model_code_requested": vm_used,
        "model_year_requested": model_year,
        "model_year_resolved": yr_res if yr_res is not None else model_year,
        "resolution_strategy": strategy,
        "warning": out_warn,
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
