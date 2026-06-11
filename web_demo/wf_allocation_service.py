# -*- coding: utf-8 -*-
"""Window Film — phân bổ nhiều nguồn LOT/OFFCUT theo hạng mục kính (trước duyệt, không trừ kho)."""
from __future__ import annotations

import json
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import DbLotInventory, DbOffcutInventory, DbRequest, DbVehicleProfile, DbWorkstream
from inventory_api import LOT_TERMINAL, _norm_lot_status
from vehicle_norm_logic import normalize_vehicle_model_code, resolve_vehicle_norm_with_year_fallback

# Đồng bộ inventory_api — LOT demo không gợi ý mặc định
LOT_DEMO_IDS_HIDE_FROM_ACTIVE_OPTIONS = frozenset(
    {"LOT-DEMO-CLEARED-001", "LOT-DEMO-DEPLETED-001", "LOT-DEMO-LOCKED-001"}
)

WINDOW_FILM_JOB_TEMPLATE: List[Dict[str, str]] = [
    {"job_item": "WINDSHIELD", "item_name": "Kính lái"},
    {"job_item": "REAR_WINDOW", "item_name": "Kính hậu"},
    {"job_item": "FRONT_SIDE", "item_name": "Sườn trước"},
    {"job_item": "REAR_SIDE_TRIANGLE", "item_name": "Sườn sau + tam giác"},
    {"job_item": "TRIANGLE", "item_name": "Tam giác"},
    {"job_item": "REAR_SIDE", "item_name": "Sườn sau"},
    {"job_item": "SUNROOF", "item_name": "Kính trời"},
]

# Cạnh lớn ~ khổ cuộn (152cm) → mét trừ LOT theo cạnh nhỏ (tận khổ)
ROLL_WIDTH_FULL_CM = 150.0


def _mc_norm(it: Dict[str, Any]) -> str:
    return (it.get("material_code") or "").strip().upper()


def _roll_strip_m_windshield(w_cm: float, l_cm: float) -> float:
    """Kính lái: cùng quy tắc tận khổ cuộn như hạng mục khác (vd 87×152 → 0,87m)."""
    return _roll_strip_m_non_windshield(w_cm, l_cm)


def _roll_strip_m_non_windshield(w_cm: float, l_cm: float) -> float:
    """Hạng mục khác: nếu một cạnh ≥ khổ cuộn thì mét trừ = cạnh nhỏ/100 (vd 50×152 → 0,5m)."""
    w, l = float(w_cm or 0), float(l_cm or 0)
    if w <= 0 or l <= 0:
        return 0.0
    lo, hi = (w, l) if w <= l else (l, w)
    return lo / 100.0



def _auto_split_rear_front_length(items: List[Dict[str, Any]]) -> None:
    by_code = {str(x.get("item_code")): x for x in items if isinstance(x, dict)}
    r = by_code.get("REAR_WINDOW")
    f = by_code.get("FRONT_SIDE")
    if r and f and r.get("is_selected") and f.get("is_selected"):
        mc_r = (r.get("material_code") or "").strip().upper()
        mc_f = (f.get("material_code") or "").strip().upper()
        if mc_r and mc_r == mc_f:
            rw = float(r.get("required_width_cm") or 0)
            rl = float(r.get("required_length_cm") or 0)
            fw = float(f.get("required_width_cm") or 0)
            fl = float(f.get("required_length_cm") or 0)
            if rw > 0 and rl > 0 and fw > 0 and fl > 0 and abs(rl - fl) <= 1.0 and (rw + fw) <= 152.0:
                common_l = max(rl, fl) / 100.0
                r_share = round((common_l / 2), 2)
                f_share = common_l - r_share
                r["required_length_m"] = r_share
                f["required_length_m"] = f_share
                # Also split in sources if they exist
                for src in r.get("sources") or []:
                    src["allocated_length_m"] = r_share
                for src in f.get("sources") or []:
                    src["allocated_length_m"] = f_share


def compute_wf_roll_cut_summary(alloc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tổng hợp khổ cắt gộp (phim cách nhiệt) theo mã vật tư — dùng hiển thị và kiểm tra tổng mét trừ LOT.

    Quy tắc nghiệp vụ:
    - Kính hậu + Sườn trước cùng material_code và cùng chiều dài (cm, lệch ≤1cm):
      một khối L×(W1+W2), mét khổ = L/100 (vd 60×130 + 92×130 → 130×152 → 1,3m).
    - Kính lái và các hạng mục đơn lẻ: cạnh lớn ≥ ~152cm (tận khổ cuộn) thì mét chạy cuộn = cạnh nhỏ/100,
      ngược lại mét = cạnh lớn/100 (vd 87×152 → 0,87m).
    """
    items = [x for x in (alloc.get("items") or []) if isinstance(x, dict)]
    by_code = {str(x.get("item_code")): x for x in items if x.get("item_code")}
    blocks: List[Dict[str, Any]] = []
    consumed: set[str] = set()

    r = by_code.get("REAR_WINDOW")
    f = by_code.get("FRONT_SIDE")
    if r and f and r.get("is_selected") and f.get("is_selected"):
        mc_r, mc_f = _mc_norm(r), _mc_norm(f)
        if mc_r and mc_r == mc_f:
            rw, rl = float(r.get("required_width_cm") or 0), float(r.get("required_length_cm") or 0)
            fw, fl = float(f.get("required_width_cm") or 0), float(f.get("required_length_cm") or 0)
            if rw > 0 and rl > 0 and fw > 0 and fl > 0 and abs(rl - fl) <= 1.0:
                common_l = rl
                wsum = rw + fw
                strip_m = common_l / 100.0
                blocks.append(
                    {
                        "kind": "MERGED_REAR_FRONT",
                        "material_code": mc_r,
                        "label": "Kính hậu + Sườn trước (gộp khổ)",
                        "block_cm": f"{int(round(common_l))}×{int(round(wsum))}",
                        "roll_strip_m": strip_m,
                        "item_codes": ["REAR_WINDOW", "FRONT_SIDE"],
                    }
                )
                consumed.update({"REAR_WINDOW", "FRONT_SIDE"})

    tmpl_by_ji = {t["job_item"]: t["item_name"] for t in WINDOW_FILM_JOB_TEMPLATE}
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        if ji in consumed:
            continue
        it = by_code.get(ji)
        if not it or not it.get("is_selected"):
            continue
        mc = _mc_norm(it)
        if not mc:
            continue
        w_cm = float(it.get("required_width_cm") or 0)
        l_cm = float(it.get("required_length_cm") or 0)
        if w_cm <= 0 or l_cm <= 0:
            continue
        if ji == "WINDSHIELD":
            strip_m = _roll_strip_m_windshield(w_cm, l_cm)
        else:
            strip_m = _roll_strip_m_non_windshield(w_cm, l_cm)
        blocks.append(
            {
                "kind": "SINGLE",
                "material_code": mc,
                "label": tmpl_by_ji.get(ji, ji),
                "block_cm": f"{int(round(w_cm))}×{int(round(l_cm))}",
                "roll_strip_m": strip_m,
                "item_codes": [ji],
            }
        )

    by_material: Dict[str, Dict[str, Any]] = {}
    for b in blocks:
        mc = b["material_code"]
        if mc not in by_material:
            by_material[mc] = {"material_code": mc, "blocks": [], "total_roll_strip_m": 0.0}
        by_material[mc]["blocks"].append({k: v for k, v in b.items() if k != "material_code"})
        by_material[mc]["total_roll_strip_m"] += float(b.get("roll_strip_m") or 0)

    lines_vi: List[str] = []
    for mc in sorted(by_material.keys()):
        row = by_material[mc]
        parts = [f"{x.get('block_cm', '')} cm — {x.get('label', '')}" for x in row["blocks"]]
        tot = float(row["total_roll_strip_m"] or 0)
        cm_run = int(round(tot * 100.0 + 1e-9))
        lines_vi.append(
            f"{mc}: "
            + "; ".join(parts)
            + f" → tổng mét trừ LOT (gộp khổ): <strong>{tot:.2f} m</strong> ({cm_run} cm chạy cuộn)"
        )

    return {
        "version": 1,
        "blocks": blocks,
        "by_material": by_material,
        "lines_html": "<br>".join(lines_vi),
        "note": "Kiểm tra phân bổ: tổng mét đã nhập theo từng mã vật tư phải ≥ tổng mét gộp khổ ở trên.",
    }


def _err(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"error": code, "message": message})


def _service_wf_jobs(req: Optional[DbRequest]) -> set:
    if not req or not req.service_selection_json:
        return set()
    try:
        svc = json.loads(req.service_selection_json)
    except json.JSONDecodeError:
        return set()
    return {str(x).strip() for x in (svc.get("window_film_items") or []) if str(x).strip()}


def _job_items_from_request(req: Optional[DbRequest]) -> set:
    if not req or not req.job_items:
        return set()
    return {x.strip() for x in (req.job_items or "").split(";") if x.strip()}


def _effective_vm_and_year(db: Session, req: Optional[DbRequest]) -> Tuple[str, Optional[int]]:
    if not req:
        return "", None
    veh = None
    if req.vehicle_id:
        veh = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == req.vehicle_id).first()
    raw_vm = (req.vehicle_model_code or "").strip()
    if not raw_vm and veh:
        raw_vm = (veh.vehicle_model_code or "").strip()
    if not raw_vm and veh:
        raw_vm = (veh.model_name or "").strip()
    vm = normalize_vehicle_model_code(raw_vm) or raw_vm.upper()
    my = None
    if veh and veh.model_year is not None:
        my = int(veh.model_year)
    return vm, my


def _pick_default_lot(
    db: Session,
    material_code: str,
    min_len_m: float,
    min_width_m: float,
    request_id: str,
) -> Optional[DbLotInventory]:
    mc = (material_code or "").strip()
    if not mc or min_len_m <= 0:
        return None
    lr = (request_id or "").strip()
    for lot in (
        db.query(DbLotInventory)
        .filter(DbLotInventory.material_code == mc)
        .order_by(DbLotInventory.import_date.asc())
        .all()
    ):
        if lot.lot_id in LOT_DEMO_IDS_HIDE_FROM_ACTIVE_OPTIONS:
            continue
        eff = _norm_lot_status(lot)
        if eff in LOT_TERMINAL or eff == "DEPLETED":
            continue
        if eff not in ("NEW", "IN_USE"):
            continue
        rem = float(lot.remaining_length_m or 0)
        if rem <= 1e-9 or rem + 1e-9 < min_len_m:
            continue
        wm = float(lot.original_width_m or 0)
        if min_width_m > 0 and wm > 0 and wm + 1e-9 < min_width_m:
            continue
        if lot.is_locked and (lot.locked_by_request_id or "").strip() and lr and (lot.locked_by_request_id or "").strip() != lr:
            continue
        return lot
    return None


def build_default_wf_allocation(db: Session, ws: DbWorkstream) -> Dict[str, Any]:
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    svc_jobs = _service_wf_jobs(req)
    job_fallback = _job_items_from_request(req)
    plan_list: List[Dict[str, Any]] = []
    if ws.material_plan:
        try:
            plan_list = json.loads(ws.material_plan)
        except json.JSONDecodeError:
            plan_list = []
    plan_by = {str(p.get("job_item")): p for p in plan_list if isinstance(p, dict)}

    vm, my = _effective_vm_and_year(db, req)
    norm_film_type = "Cường lực" if (ws.workstream_type or "") == "GLASS_FILM_INSTALLATION" else "Phim cách nhiệt"
    norm_res = resolve_vehicle_norm_with_year_fallback(db, vm, my, norm_film_type)
    auto_by = {str(x.get("job_item")): x for x in (norm_res.get("auto_fill_items") or []) if x.get("job_item")}

    MAIN_DEFAULT = {"WINDSHIELD", "REAR_WINDOW", "FRONT_SIDE", "REAR_SIDE_TRIANGLE"}
    rid = (ws.request_id or "").strip()

    items: List[Dict[str, Any]] = []
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        row = dict(plan_by.get(ji) or {})
        af = auto_by.get(ji) or {}
        w_cm = float(row.get("width_cm") or af.get("width_cm") or 0)
        l_cm = float(row.get("length_cm") or af.get("length_cm") or 0)
        mc = (row.get("material_code") or af.get("material_code") or "").strip()
        sz = (row.get("size") or af.get("size") or "").strip()
        if w_cm > 0 and l_cm > 0 and not sz:
            sz = f"{int(w_cm)}x{int(l_cm)}"

        has_norm_size = w_cm > 0 and l_cm > 0
        if svc_jobs:
            in_svc = ji in svc_jobs
        else:
            in_svc = ji in job_fallback if job_fallback else (ji in MAIN_DEFAULT)

        if ji in MAIN_DEFAULT:
            want = has_norm_size and in_svc
        else:
            want = has_norm_size and in_svc and ji in svc_jobs

        is_sel = bool(want and mc)
        qty = 1 if is_sel else 0
        if is_sel:
            if w_cm > 0 and l_cm > 0:
                strip_m = _roll_strip_m_non_windshield(w_cm, l_cm)
                req_m = round(strip_m * max(1, qty), 4)
            else:
                req_m = round((l_cm / 100.0) * max(1, qty), 4)
        else:
            req_m = 0.0
        sources: List[Dict[str, Any]] = []
        if is_sel and mc and req_m > 0:
            sid = (ws.allocated_source_id or "").strip() if (ws.allocated_source_type or "").upper() == "LOT" else ""
            if sid:
                sources = [{"source_type": "LOT", "source_id": sid, "allocated_length_m": req_m, "note": ""}]
            else:
                lot = _pick_default_lot(db, mc, req_m, 1.51, rid)
                if lot:
                    sources = [{"source_type": "LOT", "source_id": lot.lot_id, "allocated_length_m": req_m, "note": ""}]
                else:
                    sources = [{"source_type": "LOT", "source_id": "", "allocated_length_m": req_m, "note": ""}]
        items.append(
            {
                "item_code": ji,
                "item_name": tmpl["item_name"],
                "is_selected": is_sel,
                "quantity": qty,
                "material_code": mc if is_sel else "",
                "planned_size": sz if is_sel else "",
                "required_width_cm": w_cm if is_sel else 0.0,
                "required_length_cm": l_cm if is_sel else 0.0,
                "required_length_m": req_m if is_sel else 0.0,
                "sources": sources if is_sel else [],
            }
        )
    _auto_split_rear_front_length(items)
    return {
        "workstream_id": ws.workstream_id,
        "workstream_type": "WINDOW_FILM_INSTALLATION",
        "items": items,
        "change_reason": "",
        "roll_cut_summary": compute_wf_roll_cut_summary(
            {
                "workstream_id": ws.workstream_id,
                "workstream_type": "WINDOW_FILM_INSTALLATION",
                "items": items,
                "change_reason": "",
            }
        ),
    }


def _normalize_wf_body(body: Dict[str, Any], ws: DbWorkstream) -> Dict[str, Any]:
    body = dict(body or {})
    body.pop("roll_cut_summary", None)
    items_in = body.get("items")
    if not isinstance(items_in, list):
        raise _err("WF_INVALID_ITEM_QUANTITY", "items phải là mảng.")
    by_code = {str(x.get("item_code")): x for x in items_in if x.get("item_code")}
    out_items: List[Dict[str, Any]] = []
    for tmpl in WINDOW_FILM_JOB_TEMPLATE:
        ji = tmpl["job_item"]
        raw = by_code.get(ji) or {}
        is_sel = bool(raw.get("is_selected", False))
        qty = int(raw.get("quantity", 0) or 0)
        if is_sel and qty <= 0:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji} được chọn nhưng quantity phải > 0.")
        if not is_sel:
            qty = 0
        mc = (raw.get("material_code") or "").strip()
        if is_sel and not mc:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji}: bắt buộc material_code.")
        w_cm = float(raw.get("required_width_cm") or 0)
        l_cm = float(raw.get("required_length_cm") or 0)
        req_m = float(raw.get("required_length_m") or 0)
        sz = (raw.get("planned_size") or "").strip()
        if is_sel:
            if req_m <= 0:
                if w_cm > 0 and l_cm > 0:
                    strip_m = _roll_strip_m_non_windshield(w_cm, l_cm)
                    req_m = round(strip_m * max(1, qty), 4)
                elif l_cm > 0:
                    req_m = round((l_cm / 100.0) * max(1, qty), 4)
            if req_m <= 0:
                raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji}: required_length_m phải > 0.")
            if not sz and w_cm and l_cm:
                sz = f"{int(w_cm)}x{int(l_cm)}"
        sources_in = raw.get("sources")
        if not isinstance(sources_in, list):
            sources_in = []
        norm_src: List[Dict[str, Any]] = []
        for s in sources_in:
            if not isinstance(s, dict):
                continue
            st = (s.get("source_type") or "LOT").upper()
            sid = (s.get("source_id") or "").strip()
            al = float(s.get("allocated_length_m") or 0)
            if sid and al > 0:
                norm_src.append(
                    {
                        "source_type": st,
                        "source_id": sid,
                        "allocated_length_m": al,
                        "note": (s.get("note") or "").strip(),
                    }
                )
        if is_sel and not norm_src:
            raise _err("WF_INVALID_ITEM_QUANTITY", f"Hạng mục {ji} được chọn nhưng chưa có nguồn hợp lệ.")
        out_items.append(
            {
                "item_code": ji,
                "item_name": tmpl["item_name"],
                "is_selected": is_sel,
                "quantity": qty if is_sel else 0,
                "material_code": mc if is_sel else "",
                "planned_size": sz if is_sel else "",
                "required_width_cm": w_cm if is_sel else 0.0,
                "required_length_cm": l_cm if is_sel else 0.0,
                "required_length_m": req_m if is_sel else 0.0,
                "sources": norm_src if is_sel else [],
            }
        )
    _auto_split_rear_front_length(out_items)
    out = {
        "workstream_id": ws.workstream_id,
        "workstream_type": "WINDOW_FILM_INSTALLATION",
        "items": out_items,
        "change_reason": (body.get("change_reason") or "").strip(),
    }
    out["roll_cut_summary"] = compute_wf_roll_cut_summary(out)
    return out


def _validate_wf_source_line(
    db: Session,
    material_code: str,
    s: Dict[str, Any],
    request_id: str,
    admin_override: bool,
    min_width_m: float,
    min_len_m: float,
    check_balance: bool = True,
) -> None:
    st = (s.get("source_type") or "LOT").upper()
    sid = s.get("source_id")
    al = float(s.get("allocated_length_m") or 0)
    if st == "LOT":
        lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
        if not lot:
            raise _err("WF_SOURCE_NOT_FOUND", f"LOT {sid} không tồn tại.")
        if (lot.material_code or "").strip() != material_code:
            raise _err("WF_SOURCE_MATERIAL_MISMATCH", f"LOT {sid} không cùng material {material_code}.")
        rem = float(lot.remaining_length_m or 0)
        if check_balance and al > rem + 1e-6:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"LOT {sid} không đủ tồn ({rem}m < {al}m).")
        lock_rid = (lot.locked_by_request_id or "").strip()
        if lot.is_locked and lock_rid and lock_rid != request_id and not admin_override:
            raise _err("WF_SOURCE_LOCKED", f"LOT {sid} đang khóa bởi request khác ({lock_rid}).")
        wm = float(lot.original_width_m or 0)
        if min_width_m > 0 and wm > 0 and wm + 1e-6 < min_width_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"LOT {sid} không đủ khổ rộng cho yêu cầu.")
    elif st == "OFFCUT":
        oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
        if not oc:
            raise _err("WF_SOURCE_NOT_FOUND", f"Offcut {sid} không tồn tại.")
        if (oc.material_code or "").strip() != material_code:
            raise _err("WF_SOURCE_MATERIAL_MISMATCH", f"Offcut {sid} không cùng material {material_code}.")
        olen = float(oc.length_m or 0)
        ow = float(oc.width_m or 0)
        if check_balance and al > olen + 1e-6:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ chiều dài ({olen}m < {al}m).")
        if min_width_m > 0 and ow > 0 and ow + 1e-6 < min_width_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ khổ rộng.")
        if min_len_m > 0 and olen + 1e-6 < min_len_m:
            raise _err("WF_SOURCE_INSUFFICIENT_BALANCE", f"Offcut {sid} không đủ chiều dài kho.")
        lock_rid = (oc.locked_by_request_id or "").strip()
        if oc.is_locked and lock_rid and lock_rid != request_id and not admin_override:
            raise _err("WF_SOURCE_LOCKED", f"Offcut {sid} đang khóa bởi request khác ({lock_rid}).")
    else:
        raise _err("WF_SOURCE_NOT_FOUND", f"Loại nguồn không hợp lệ: {st}")


def validate_wf_allocation(db: Session, ws: DbWorkstream, alloc: Dict[str, Any], admin_override: bool = False) -> None:
    if ws.workstream_type not in ("WINDOW_FILM_INSTALLATION", "GLASS_FILM_INSTALLATION"):
        raise _err("WF_INVALID_ITEM_QUANTITY", "Chỉ áp dụng cho WINDOW_FILM_INSTALLATION / GLASS_FILM_INSTALLATION.")
    summary = alloc.get("roll_cut_summary") or compute_wf_roll_cut_summary(alloc)
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        mc = (it.get("material_code") or "").strip()
        w_cm = float(it.get("required_width_cm") or 0)
        l_cm = float(it.get("required_length_cm") or 0)
        min_w_m = (w_cm / 100.0) if w_cm > 0 else 0.0
        min_l_m = (l_cm / 100.0) if l_cm > 0 else 0.0
        srcs = it.get("sources") or []
        for s in srcs:
            _validate_wf_source_line(db, mc, s, ws.request_id, admin_override, min_w_m, min_l_m)

    for mc, info in (summary.get("by_material") or {}).items():
        need = float(info.get("total_roll_strip_m") or 0)
        if need <= 1e-9:
            continue
        got = 0.0
        for it in alloc.get("items") or []:
            if not it.get("is_selected"):
                continue
            if _mc_norm(it) != str(mc).strip().upper():
                continue
            for s in it.get("sources") or []:
                got += float(s.get("allocated_length_m") or 0)
        if got + 1e-6 < need:
            blocks = info.get("blocks") or []
            hint = ", ".join(f"{b.get('block_cm')} ({b.get('label')})" for b in blocks if isinstance(b, dict))
            raise _err(
                "WF_ALLOCATION_INSUFFICIENT_NESTED_ROLL",
                f"{mc}: tổng mét đã phân {got:.2f}m < tổng mét gộp khổ cần trừ LOT {need:.2f}m. ({hint})",
            )


def _totals_per_wf_source(alloc: Dict[str, Any]) -> Dict[Tuple[str, str], float]:
    """Tổng mét theo (source_type, source_id) trên một snapshot phân bổ WF."""
    out: Dict[Tuple[str, str], float] = defaultdict(float)
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            st = (s.get("source_type") or "LOT").upper()
            sid = (s.get("source_id") or "").strip()
            al = float(s.get("allocated_length_m") or 0)
            if sid and al > 0:
                out[(st, sid)] += al
    return dict(out)


def load_extra_cut_history(ws: DbWorkstream) -> List[Dict[str, Any]]:
    """Danh sách đề xuất cắt thêm đã lưu DB (JSON array)."""
    raw = getattr(ws, "extra_cut_history_json", None) or ""
    if not str(raw).strip():
        return []
    try:
        arr = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return arr if isinstance(arr, list) else []


def totals_from_extra_cut_history_entries(entries: List[Dict[str, Any]]) -> Dict[Tuple[str, str], float]:
    """Cộng dồn mét theo nguồn trên nhiều snapshot wf_allocation trong lịch sử."""
    tot: Dict[Tuple[str, str], float] = defaultdict(float)
    for ent in entries or []:
        if not isinstance(ent, dict):
            continue
        alloc = ent.get("wf_allocation")
        if not isinstance(alloc, dict):
            continue
        for k, v in _totals_per_wf_source(alloc).items():
            tot[k] += v
    return dict(tot)


def prior_extra_cut_entries_include_legacy(ws: DbWorkstream) -> List[Dict[str, Any]]:
    """
    Các đề xuất cắt thêm đã có (DB + bản ghi cũ chỉ có extra_cut_wf_allocation_json chưa có cột lịch sử).
    Dùng cho validate tích lũy và khi append lần gửi mới.
    """
    prior = list(load_extra_cut_history(ws))
    if prior:
        return prior
    if not bool(getattr(ws, "extra_cut_requested", False)):
        return []
    raw_prev = getattr(ws, "extra_cut_wf_allocation_json", None) or ""
    if not str(raw_prev).strip():
        return []
    try:
        prev_alloc = json.loads(raw_prev)
    except json.JSONDecodeError:
        return []
    if not isinstance(prev_alloc, dict) or not (prev_alloc.get("items") or []):
        return []
    return [
        {
            "proposal_id": "MIGRATED-PRE-HISTORY-V1",
            "requested_at": (getattr(ws, "created_at", None) or "") or "",
            "actor_id": (getattr(ws, "assigned_technician_id", None) or "").strip(),
            "actor_name": (getattr(ws, "assigned_technician_name", None) or "").strip(),
            "reason": (getattr(ws, "extra_cut_reason", None) or "").strip()
            or "Đề xuất cắt thêm (tích hợp từ bản ghi trước khi có lịch sử từng lần).",
            "wf_allocation": prev_alloc,
        }
    ]


def sync_extra_cut_latest_snapshot(ws: DbWorkstream) -> None:
    """Đồng bộ extra_cut_reason / extra_cut_wf_allocation_json / extra_cut_requested sau khi sửa lịch sử JSON."""
    hist = load_extra_cut_history(ws)
    if not hist:
        ws.extra_cut_history_json = None
        ws.extra_cut_requested = False
        ws.extra_cut_wf_allocation_json = None
        ws.extra_cut_reason = None
        return
    ws.extra_cut_requested = True
    last = hist[-1]
    r = (last.get("reason") or "").strip()
    ws.extra_cut_reason = r if r else None
    wa = last.get("wf_allocation")
    if getattr(ws, "workstream_type", None) in ("WINDOW_FILM_INSTALLATION", "GLASS_FILM_INSTALLATION") and isinstance(wa, dict) and (wa.get("items") or []):
        ws.extra_cut_wf_allocation_json = json.dumps(wa, ensure_ascii=False)
    else:
        ws.extra_cut_wf_allocation_json = None


def validate_wf_extra_cut_allocation(db: Session, ws: DbWorkstream, extra_alloc: Dict[str, Any]) -> None:
    """
    Đăng ký cắt thêm WF: kiểm tra gộp khổ (roll_cut_summary) + tổng mét theo từng LOT/mảnh dư
    không vượt tồn khi cộng với phân bổ đã duyệt (wf_allocation_json).
    """
    if ws.workstream_type not in ("WINDOW_FILM_INSTALLATION", "GLASS_FILM_INSTALLATION"):
        raise _err("WF_INVALID_ITEM_QUANTITY", "Chỉ workstream Phim cách nhiệt / Cường lực.")
    n_items, n_src = _count_sources(extra_alloc)
    if n_items < 1 or n_src < 1:
        raise _err(
            "WF_INVALID_ITEM_QUANTITY",
            "Đăng ký cắt thêm: chọn ít nhất một hạng mục và gán nguồn LOT/mảnh dư với mét > 0.",
        )
    base: Dict[str, Any] = {}
    if getattr(ws, "wf_allocation_json", None):
        try:
            base = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            base = {}
    base_use = _totals_per_wf_source(base)
    extra_use = _totals_per_wf_source(extra_alloc)
    prior_entries = prior_extra_cut_entries_include_legacy(ws)
    hist_use = totals_from_extra_cut_history_entries(prior_entries)
    summary = extra_alloc.get("roll_cut_summary") or compute_wf_roll_cut_summary(extra_alloc)
    for mc, info in (summary.get("by_material") or {}).items():
        need = float(info.get("total_roll_strip_m") or 0)
        if need <= 1e-9:
            continue
        got = 0.0
        for it in extra_alloc.get("items") or []:
            if not it.get("is_selected"):
                continue
            if _mc_norm(it) != str(mc).strip().upper():
                continue
            for s in it.get("sources") or []:
                got += float(s.get("allocated_length_m") or 0)
        if got + 1e-6 < need:
            blocks = info.get("blocks") or []
            hint = ", ".join(f"{b.get('block_cm')} ({b.get('label')})" for b in blocks if isinstance(b, dict))
            raise _err(
                "WF_ALLOCATION_INSUFFICIENT_NESTED_ROLL",
                f"Cắt thêm — {mc}: tổng mét nguồn {got:.2f}m < gộp khổ cần {need:.2f}m. ({hint})",
            )
    for key in set(base_use) | set(hist_use) | set(extra_use):
        st, sid = key
        need = base_use.get(key, 0.0) + hist_use.get(key, 0.0) + extra_use.get(key, 0.0)
        if need <= 1e-9:
            continue
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if not lot:
                raise _err("WF_SOURCE_NOT_FOUND", f"LOT {sid} không tồn tại.")
            rem = float(lot.remaining_length_m or 0)
            if need > rem + 1e-6:
                raise _err(
                    "WF_SOURCE_INSUFFICIENT_BALANCE",
                    f"LOT {sid}: phân bổ ban đầu + cắt thêm cần {need:.2f}m > tồn {rem:.2f}m.",
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if not oc:
                raise _err("WF_SOURCE_NOT_FOUND", f"Offcut {sid} không tồn tại.")
            olen = float(oc.length_m or 0)
            if need > olen + 1e-6:
                raise _err(
                    "WF_SOURCE_INSUFFICIENT_BALANCE",
                    f"Offcut {sid}: tổng cần {need:.2f}m > chiều dài kho {olen:.2f}m.",
                )
    rid = (ws.request_id or "").strip()
    for it in extra_alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        mc = (it.get("material_code") or "").strip()
        w_cm = float(it.get("required_width_cm") or 0)
        l_cm = float(it.get("required_length_cm") or 0)
        min_w_m = (w_cm / 100.0) if w_cm > 0 else 0.0
        min_l_m = (l_cm / 100.0) if l_cm > 0 else 0.0
        for s in it.get("sources") or []:
            if float(s.get("allocated_length_m") or 0) <= 1e-9:
                continue
            _validate_wf_source_line(db, mc, s, rid, False, min_w_m, min_l_m, check_balance=False)


def commit_wf_extra_cut_inventory(db: Session, ws: DbWorkstream, tech_id: str, audit_fn) -> bool:
    """Trừ kho theo từng đợt đề xuất cắt thêm (lịch sử); tương thích bản ghi chỉ có extra_cut_wf_allocation_json."""
    allocs: List[Dict[str, Any]] = []
    hist = load_extra_cut_history(ws)
    if hist:
        for ent in hist:
            a = ent.get("wf_allocation") if isinstance(ent, dict) else None
            if isinstance(a, dict) and (a.get("items") or []):
                allocs.append(a)
    else:
        raw = getattr(ws, "extra_cut_wf_allocation_json", None) or ""
        if raw.strip():
            try:
                a = json.loads(raw)
            except json.JSONDecodeError:
                a = None
            if isinstance(a, dict) and (a.get("items") or []):
                allocs.append(a)
    if not allocs:
        return False

    def _commit_one_alloc(alloc: Dict[str, Any], batch_note: str) -> None:
        flat: List[Dict[str, Any]] = []
        for it in alloc.get("items") or []:
            if not it.get("is_selected"):
                continue
            mc = (it.get("material_code") or "").strip()
            for s in it.get("sources") or []:
                take = float(s.get("allocated_length_m") or 0)
                sid = (s.get("source_id") or "").strip()
                if sid and take > 0:
                    x = dict(s)
                    x["_material_code"] = mc
                    flat.append(x)
        for s in flat:
            st = (s.get("source_type") or "LOT").upper()
            sid = s.get("source_id")
            take = float(s.get("allocated_length_m") or 0)
            mc = s.get("_material_code") or ws.selected_material_code
            if st == "LOT":
                lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
                if lot and (lot.material_code or "").strip() == (mc or "").strip():
                    before = float(lot.remaining_length_m or 0)
                    lot.remaining_length_m = round(max(0.0, before - take), 3)
                    after = lot.remaining_length_m
                    lot.is_locked = False
                    lot.is_opened = True
                    lot.locked_by_request_id = None
                    lot.locked_by_workstream_id = None
                    audit_fn(
                        ws.request_id,
                        "ISSUE_FROM_LOT",
                        "LOT",
                        sid,
                        f"{before}m",
                        f"{after}m",
                        f"Commit WF cắt bổ sung — KTV {tech_id}{batch_note}",
                        tech_id,
                        ws.workstream_id,
                        ws.workstream_type,
                    )
            elif st == "OFFCUT":
                oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
                if oc and (oc.material_code or "").strip() == (mc or "").strip():
                    before = float(oc.length_m or 0)
                    new_len = round(max(0.0, before - take), 3)
                    oc.length_m = new_len
                    oc.area_m2 = round((oc.width_m or 0) * new_len, 3) if oc.width_m else 0.0
                    if new_len <= 1e-6:
                        oc.offcut_status = "USED"
                        oc.status = "USED"
                    oc.is_locked = False
                    oc.locked_by_request_id = None
                    oc.locked_by_workstream_id = None
                    audit_fn(
                        ws.request_id,
                        "ISSUE_FROM_OFFCUT",
                        "OFFCUT",
                        sid,
                        f"{before}m",
                        f"{new_len}m",
                        f"Commit WF cắt bổ sung — KTV {tech_id}{batch_note}",
                        tech_id,
                        ws.workstream_id,
                        ws.workstream_type,
                    )

    n = len(allocs)
    for i, alloc in enumerate(allocs):
        note = f" ({i + 1}/{n})" if n > 1 else ""
        _commit_one_alloc(alloc, note)
    return True


def _wf_snapshot_differs(prev: Dict[str, Any], new: Dict[str, Any]) -> bool:
    def _strip_roll(d: Dict[str, Any]) -> Dict[str, Any]:
        x = dict(d)
        x.pop("roll_cut_summary", None)
        return x

    prev = _strip_roll(prev) if isinstance(prev, dict) else prev
    new = _strip_roll(new) if isinstance(new, dict) else new
    old_items = {x["item_code"]: x for x in (prev.get("items") or [])}
    for it in new.get("items") or []:
        code = it.get("item_code")
        o = old_items.get(code) or {}
        if bool(it.get("is_selected")) != bool(o.get("is_selected")):
            return True
        if int(it.get("quantity") or 0) != int(o.get("quantity") or 0):
            return True
        if (it.get("material_code") or "") != (o.get("material_code") or ""):
            return True
        if abs(float(it.get("required_length_m") or 0) - float(o.get("required_length_m") or 0)) > 1e-6:
            return True
        if abs(float(it.get("required_width_cm") or 0) - float(o.get("required_width_cm") or 0)) > 1e-6:
            return True
        if abs(float(it.get("required_length_cm") or 0) - float(o.get("required_length_cm") or 0)) > 1e-6:
            return True
        if (str(it.get("planned_size") or "").strip() != str(o.get("planned_size") or "").strip()):
            return True
        ns, osrc = it.get("sources") or [], o.get("sources") or []
        if len(ns) != len(osrc):
            return True
        for i, s in enumerate(ns):
            if i >= len(osrc):
                return True
            os = osrc[i]
            if (s.get("source_type") or "") != (os.get("source_type") or ""):
                return True
            if (s.get("source_id") or "") != (os.get("source_id") or ""):
                return True
            if abs(float(s.get("allocated_length_m") or 0) - float(os.get("allocated_length_m") or 0)) > 1e-6:
                return True
    return False


def _count_sources(alloc: Dict[str, Any]) -> Tuple[int, int]:
    n_items = sum(1 for x in (alloc.get("items") or []) if x.get("is_selected"))
    n_src = 0
    for x in alloc.get("items") or []:
        if not x.get("is_selected"):
            continue
        for s in x.get("sources") or []:
            if (s.get("source_id") or "").strip() and float(s.get("allocated_length_m") or 0) > 0:
                n_src += 1
    return n_items, n_src


def put_wf_allocation(
    db: Session,
    ws_id: str,
    body: Dict[str, Any],
    actor: str = "QL-002",
) -> Dict[str, Any]:
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws:
        raise HTTPException(404, {"error": "NOT_FOUND", "message": "Workstream không tồn tại."})
    if ws.workstream_type not in ("WINDOW_FILM_INSTALLATION", "GLASS_FILM_INSTALLATION"):
        raise HTTPException(400, {"error": "INVALID", "message": "Chỉ workstream Phim cách nhiệt / Cường lực."})
    # Cho phép chỉnh phân bổ đến khi luồng kết thúc / hủy / đã ghi nhận trừ kho. PENDING_APPROVAL = duyệt mã phim (API khác).
    _BLOCKED_WF_PUT_ALLOC = frozenset(
        {
            "PENDING_APPROVAL",
            "CLOSED",
            "COMPLETED",
            "CANCELLED",
        }
    )
    if ws.status in _BLOCKED_WF_PUT_ALLOC:
        raise HTTPException(
            400,
            {
                "error": "INVALID",
                "message": (
                    "Không chỉnh phân bổ LOT ở trạng thái này. "
                    "Nếu đang PENDING_APPROVAL — dùng màn duyệt mã phim; "
                    "nếu luồng đã đóng/hủy/hoàn tất — không sửa allocation. "
                    f"Hiện: {ws.status}."
                ),
            },
        )
    if getattr(ws, "inventory_committed", False):
        raise HTTPException(
            400,
            {
                "error": "INVALID",
                "message": "Đã ghi nhận trừ kho (inventory_committed) — không chỉnh phân bổ LOT trên màn này.",
            },
        )

    prev_raw = getattr(ws, "wf_allocation_json", None) or ""
    prev_snap: Dict[str, Any]
    if prev_raw:
        try:
            prev_snap = json.loads(prev_raw)
        except json.JSONDecodeError:
            prev_snap = build_default_wf_allocation(db, ws)
    else:
        prev_snap = build_default_wf_allocation(db, ws)

    admin_ov = bool(body.get("admin_override"))
    alloc = _normalize_wf_body(body, ws)
    validate_wf_allocation(db, ws, alloc, admin_override=admin_ov)

    if _wf_snapshot_differs(prev_snap, alloc):
        if not (alloc.get("change_reason") or "").strip():
            raise _err("WF_CHANGE_REASON_REQUIRED", "Bắt buộc nhập change_reason khi thay đổi phân bổ WF.")

    # legacy: first selected source + first windshield block
    first_sel = next((x for x in alloc["items"] if x.get("is_selected")), None)
    if first_sel:
        srcs = first_sel.get("sources") or []
        if srcs:
            ws.allocated_source_type = (srcs[0].get("source_type") or "LOT").upper()
            ws.allocated_source_id = srcs[0].get("source_id") or ""
        ws.selected_material_code = first_sel.get("material_code") or ws.selected_material_code
        ws.planned_cut_block = first_sel.get("planned_size") or ws.planned_cut_block
        ws.planned_deduction_length_m = float(first_sel.get("required_length_m") or ws.planned_deduction_length_m or 0)

    # sync material_plan material_code / sizes from allocation
    try:
        plan = json.loads(ws.material_plan or "[]")
    except json.JSONDecodeError:
        plan = []
    idx = {r.get("job_item"): i for i, r in enumerate(plan) if isinstance(r, dict)}
    for it in alloc["items"]:
        ji = it.get("item_code")
        if ji not in idx:
            continue
        row = plan[idx[ji]]
        if it.get("is_selected"):
            row["material_code"] = it.get("material_code") or row.get("material_code")
            row["size"] = it.get("planned_size") or row.get("size")
            row["width_cm"] = it.get("required_width_cm") or row.get("width_cm")
            row["length_cm"] = it.get("required_length_cm") or row.get("length_cm")
    ws.material_plan = json.dumps(plan, ensure_ascii=False)
    ws.wf_allocation_json = json.dumps(alloc, ensure_ascii=False)

    n_items, n_src = _count_sources(alloc)
    return {
        "ok": True,
        "workstream_id": ws_id,
        "allocation_status": "READY_FOR_APPROVAL",
        "selected_items_count": n_items,
        "sources_count": n_src,
        "next_step": "MANAGER_APPROVAL",
    }


def validate_wf_allocation_at_approve(db: Session, ws: DbWorkstream) -> None:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return
    validate_wf_allocation(db, ws, alloc, admin_override=False)


def soft_lock_wf_allocation_sources(db: Session, ws: DbWorkstream, approved_by: str, audit_fn) -> int:
    alloc: Dict[str, Any] = {}
    if getattr(ws, "wf_allocation_json", None):
        try:
            alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            sid = (s.get("source_id") or "").strip()
            if sid and float(s.get("allocated_length_m") or 0) > 0:
                flat.append(dict(s))
    if not flat and ws.allocated_source_id:
        flat.append(
            {
                "source_type": (ws.allocated_source_type or "LOT").upper(),
                "source_id": ws.allocated_source_id,
                "allocated_length_m": float(ws.planned_deduction_length_m or 0),
            }
        )
    n = 0
    for s in flat:
        st = (s.get("source_type") or "LOT").upper()
        sid = s.get("source_id")
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if lot:
                lot.is_locked = True
                lot.locked_by_request_id = ws.request_id
                lot.locked_by_workstream_id = ws.workstream_id
                n += 1
                audit_fn(
                    ws.request_id,
                    "SOFT_LOCK_RECORDED",
                    "LOT",
                    sid,
                    "is_locked=false",
                    "is_locked=true",
                    f"Soft lock WF split — {approved_by}",
                    approved_by,
                    ws.workstream_id,
                    ws.workstream_type,
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if oc:
                oc.is_locked = True
                oc.locked_by_request_id = ws.request_id
                oc.locked_by_workstream_id = ws.workstream_id
                n += 1
                audit_fn(
                    ws.request_id,
                    "SOFT_LOCK_RECORDED",
                    "OFFCUT",
                    sid,
                    "is_locked=false",
                    "is_locked=true",
                    f"Soft lock WF split — {approved_by}",
                    approved_by,
                    ws.workstream_id,
                    ws.workstream_type,
                )
    if len(flat) > 1:
        audit_fn(
            ws.request_id,
            "WINDOW_FILM_SOURCE_SPLIT",
            "WORKSTREAM",
            ws.workstream_id,
            None,
            json.dumps([{"id": x.get("source_id"), "m": x.get("allocated_length_m")} for x in flat], ensure_ascii=False),
            "Phê duyệt WF — chia nhiều nguồn",
            approved_by,
            ws.workstream_id,
            ws.workstream_type,
        )
    return n


def commit_wf_multi_source_inventory(db: Session, ws: DbWorkstream, tech_id: str, audit_fn) -> bool:
    alloc: Dict[str, Any] = {}
    if getattr(ws, "wf_allocation_json", None):
        try:
            alloc = json.loads(ws.wf_allocation_json)
        except json.JSONDecodeError:
            alloc = {}
    flat: List[Dict[str, Any]] = []
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        mc = (it.get("material_code") or "").strip()
        for s in it.get("sources") or []:
            take = float(s.get("allocated_length_m") or 0)
            sid = (s.get("source_id") or "").strip()
            if sid and take > 0:
                x = dict(s)
                x["_material_code"] = mc
                flat.append(x)
    if not flat:
        return False
    for s in flat:
        st = (s.get("source_type") or "LOT").upper()
        sid = s.get("source_id")
        take = float(s.get("allocated_length_m") or 0)
        mc = s.get("_material_code") or ws.selected_material_code
        if st == "LOT":
            lot = db.query(DbLotInventory).filter(DbLotInventory.lot_id == sid).first()
            if lot and (lot.material_code or "").strip() == (mc or "").strip():
                before = float(lot.remaining_length_m or 0)
                lot.remaining_length_m = round(max(0.0, before - take), 3)
                after = lot.remaining_length_m
                lot.is_locked = False
                lot.is_opened = True
                lot.locked_by_request_id = None
                lot.locked_by_workstream_id = None
                audit_fn(
                    ws.request_id,
                    "ISSUE_FROM_LOT",
                    "LOT",
                    sid,
                    f"{before}m",
                    f"{after}m",
                    f"Commit WF multi-source — KTV {tech_id}",
                    tech_id,
                    ws.workstream_id,
                    ws.workstream_type,
                )
                audit_fn(
                    ws.request_id,
                    "RELEASE_LOCK",
                    "LOT",
                    sid,
                    "is_locked=true",
                    "is_locked=false",
                    "Giải phóng lock sau commit WF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )
        elif st == "OFFCUT":
            oc = db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id == sid).first()
            if oc and (oc.material_code or "").strip() == (mc or "").strip():
                before = float(oc.length_m or 0)
                new_len = round(max(0.0, before - take), 3)
                oc.length_m = new_len
                oc.area_m2 = round((oc.width_m or 0) * new_len, 3) if oc.width_m else 0.0
                if new_len <= 1e-6:
                    oc.offcut_status = "USED"
                    oc.status = "USED"
                oc.is_locked = False
                oc.locked_by_request_id = None
                oc.locked_by_workstream_id = None
                audit_fn(
                    ws.request_id,
                    "ISSUE_FROM_OFFCUT",
                    "OFFCUT",
                    sid,
                    f"{before}m",
                    f"{new_len}m",
                    f"Commit WF multi-source — KTV {tech_id}",
                    tech_id,
                    ws.workstream_id,
                    ws.workstream_type,
                )
                audit_fn(
                    ws.request_id,
                    "RELEASE_LOCK",
                    "OFFCUT",
                    sid,
                    "is_locked=true",
                    "is_locked=false",
                    "Giải phóng lock sau commit WF",
                    "SYSTEM",
                    ws.workstream_id,
                    ws.workstream_type,
                )
    return True


def wf_allocation_has_offcut(ws: DbWorkstream) -> bool:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return False
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return False
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            if (s.get("source_type") or "").upper() == "OFFCUT" and (s.get("source_id") or "").strip():
                return True
    return False


def wf_allocation_has_multi_sources(ws: DbWorkstream) -> bool:
    raw = getattr(ws, "wf_allocation_json", None) or ""
    if not raw:
        return False
    try:
        alloc = json.loads(raw)
    except json.JSONDecodeError:
        return False
    n = 0
    for it in alloc.get("items") or []:
        if not it.get("is_selected"):
            continue
        for s in it.get("sources") or []:
            if (s.get("source_id") or "").strip() and float(s.get("allocated_length_m") or 0) > 0:
                n += 1
    return n > 1


# ═══════════════════════════════════════════════════════════════════════════════
# FLOOR MAT — reserve / confirm_deduct / release helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _fm_uid():
    import uuid
    return uuid.uuid4().hex[:10].upper()


def _fm_now():
    import datetime
    return datetime.datetime.utcnow().isoformat() + "Z"


def reserve_floor_mat(db: Session, ws: DbWorkstream) -> None:
    """Quản lý duyệt đơn → giữ chỗ qty_reserved cho từng SKU trong plan."""
    from database import DbFloorMatInventory, DbFloorMatTransaction

    raw = getattr(ws, "floor_mat_plan_json", None) or ""
    if not raw:
        return
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        return
    for item in plan:
        sku = (item.get("sku") or "").strip()
        qty = int(item.get("qty") or 0)
        if not sku or qty <= 0:
            continue
        row = db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first()
        if not row:
            continue
        avail = (row.qty_total or 0) - (row.qty_reserved or 0)
        if avail < qty:
            raise HTTPException(
                400,
                {"error": "FM_INSUFFICIENT_STOCK", "message": f"SKU {sku}: chỉ còn {avail} {row.unit}, cần {qty}."},
            )
        row.qty_reserved = (row.qty_reserved or 0) + qty
        db.add(DbFloorMatTransaction(
            tx_id=f"FMT-{_fm_uid()}",
            sku=sku,
            request_id=ws.request_id,
            workstream_id=ws.workstream_id,
            tx_type="RESERVE",
            quantity=qty,
            performed_by="SYSTEM",
            note=f"Giữ chỗ khi duyệt đơn {ws.request_id}",
            created_at=_fm_now(),
        ))


def confirm_floor_mat_deduct(db: Session, ws: DbWorkstream) -> None:
    """KTV hoàn tất thi công → trừ qty_total và giải phóng qty_reserved."""
    from database import DbFloorMatInventory, DbFloorMatTransaction

    raw = getattr(ws, "floor_mat_plan_json", None) or ""
    if not raw:
        return
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        return
    for item in plan:
        sku = (item.get("sku") or "").strip()
        qty = int(item.get("qty") or 0)
        if not sku or qty <= 0:
            continue
        row = db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first()
        if not row:
            continue
        row.qty_total = max(0, (row.qty_total or 0) - qty)
        row.qty_reserved = max(0, (row.qty_reserved or 0) - qty)
        db.add(DbFloorMatTransaction(
            tx_id=f"FMT-{_fm_uid()}",
            sku=sku,
            request_id=ws.request_id,
            workstream_id=ws.workstream_id,
            tx_type="CONFIRM_DEDUCT",
            quantity=qty,
            performed_by="SYSTEM",
            note=f"Xác nhận trừ kho sau thi công {ws.workstream_id}",
            created_at=_fm_now(),
        ))


def release_floor_mat(db: Session, ws: DbWorkstream) -> None:
    """Từ chối / hủy đơn → giải phóng qty_reserved."""
    from database import DbFloorMatInventory, DbFloorMatTransaction

    raw = getattr(ws, "floor_mat_plan_json", None) or ""
    if not raw:
        return
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        return
    for item in plan:
        sku = (item.get("sku") or "").strip()
        qty = int(item.get("qty") or 0)
        if not sku or qty <= 0:
            continue
        row = db.query(DbFloorMatInventory).filter(DbFloorMatInventory.sku == sku).first()
        if not row:
            continue
        row.qty_reserved = max(0, (row.qty_reserved or 0) - qty)
        db.add(DbFloorMatTransaction(
            tx_id=f"FMT-{_fm_uid()}",
            sku=sku,
            request_id=ws.request_id,
            workstream_id=ws.workstream_id,
            tx_type="RELEASE",
            quantity=qty,
            performed_by="SYSTEM",
            note=f"Giải phóng giữ chỗ khi hủy {ws.workstream_id}",
            created_at=_fm_now(),
        ))
