# -*- coding: utf-8 -*-
"""Resolve vật tư ưu tiên theo DbMaterialPreference — không hardcode RT40/JB20."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from database import DbMaterialPreference

# Thứ tự hạng mục kính mặc định (dùng khi tạo plan từ danh sách job_item)
WINDOW_FILM_JOB_TEMPLATE: List[Dict[str, str]] = [
    {"job_item": "WINDSHIELD", "note": "Kính lái"},
    {"job_item": "REAR_WINDOW", "note": "Kính hậu"},
    {"job_item": "FRONT_SIDE", "note": "Sườn trước"},
    {"job_item": "REAR_SIDE_TRIANGLE", "note": "Sườn sau + tam giác"},
    {"job_item": "TRIANGLE", "note": "Tam giác"},
    {"job_item": "REAR_SIDE", "note": "Sườn sau"},
    {"job_item": "SUNROOF", "note": "Kính trời"},
]


def list_active_preferences_for(
    db: Session,
    film_type: str,
    job_item: str,
    ppf_material: Optional[str] = None,
) -> List[DbMaterialPreference]:
    ft = (film_type or "").strip()
    ji = (job_item or "").strip()
    q = (
        db.query(DbMaterialPreference)
        .filter(DbMaterialPreference.status == "ACTIVE")
        .filter(DbMaterialPreference.film_type == ft)
        .filter(DbMaterialPreference.job_item == ji)
    )
    rows = q.order_by(DbMaterialPreference.priority.asc(), DbMaterialPreference.preference_id.asc()).all()
    if ppf_material and ji == "PPF_BODY":
        rows = [r for r in rows if (r.preferred_material_code or "").upper() == ppf_material.strip().upper()]
    return rows


def resolve_material_preference(
    db: Session,
    film_type: str,
    job_item: str,
    ppf_material: Optional[str] = None,
) -> Dict[str, Any]:
    rows = list_active_preferences_for(db, film_type, job_item, ppf_material=ppf_material)
    if not rows:
        return {
            "found": False,
            "job_item": (job_item or "").strip(),
            "preferred_material_code": None,
            "options": [],
        }
    opts = [
        {
            "material_code": r.preferred_material_code,
            "material_name": r.material_name or "",
            "priority": int(r.priority or 1),
        }
        for r in rows
    ]
    top = rows[0]
    return {
        "found": True,
        "job_item": top.job_item,
        "preferred_material_code": top.preferred_material_code,
        "options": opts,
    }


def material_plan_for_job_items(db: Session, film_type: str, job_items: List[str]) -> List[Dict[str, Any]]:
    """Plan chỉ có job_item + material từ preference (chưa gắn kích thước norm)."""
    allowed = set(job_items)
    out: List[Dict[str, Any]] = []
    for row in WINDOW_FILM_JOB_TEMPLATE:
        ji = row["job_item"]
        if ji not in allowed:
            continue
        mp = resolve_material_preference(db, film_type, ji)
        mc = mp.get("preferred_material_code") or ""
        src = "MATERIAL_PREFERENCE" if mp.get("found") else "MISSING_PREFERENCE"
        out.append(
            {
                "job_item": ji,
                "note": row.get("note", ""),
                "material_code": mc,
                "material_source": src,
            }
        )
    return out


def build_default_window_film_plan_json(db: Session, film_type: str = "Phim cách nhiệt") -> str:
    """JSON plan đầy đủ hạng mục (demo legacy main.py) — material từ DB."""
    items = material_plan_for_job_items(
        db,
        film_type,
        [r["job_item"] for r in WINDOW_FILM_JOB_TEMPLATE],
    )
    return json.dumps(items, ensure_ascii=False)


def merge_sizes_into_plan(base_plan: List[dict], auto_fill: List[dict]) -> List[dict]:
    """Gắn size/width/length từ auto_fill vào plan có sẵn (theo job_item)."""
    idx = {x["job_item"]: x for x in auto_fill}
    out = []
    for p in base_plan:
        cp = dict(p)
        it = idx.get(cp.get("job_item"))
        if it:
            for k in ("size", "width_cm", "length_cm", "material_code", "material_source"):
                if k in it and it[k] is not None:
                    cp[k] = it[k]
        out.append(cp)
    return out
