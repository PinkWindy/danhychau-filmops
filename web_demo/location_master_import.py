# -*- coding: utf-8 -*-
"""
Import danh mục Tỉnh/TP (cột D) và Phường/Xã (cột J) từ Excel → static/location_master.json.

Chạy từ thư mục web_demo:
  python location_master_import.py

File nguồn mặc định: data/Danh-muc-Phuong-xa_moi.xlsx
Sheet: 1.DM Phường xã mới — header dòng 3, dữ liệu từ dòng 4.
"""
from __future__ import annotations

import argparse
import json
import locale
import os
import re
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

try:
    from openpyxl import load_workbook
except ImportError as e:
    print("ERROR: cần cài openpyxl: pip install openpyxl", file=sys.stderr)
    raise SystemExit(1) from e

SHEET_NAME = "1.DM Phường xã mới"
COL_PROVINCE = 4  # D
COL_WARD = 10  # J
HEADER_ROW = 3
DATA_START_ROW = 4


def _base_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def default_excel_path() -> str:
    return os.path.join(_base_dir(), "data", "Danh-muc-Phuong-xa_moi.xlsx")


def default_output_path() -> str:
    return os.path.join(_base_dir(), "static", "location_master.json")


def _normalize_cell(val) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _sort_vi(strings: List[str]) -> List[str]:
    """Sắp xếp ổn định; thử locale vi nếu có rồi khôi phục LC_COLLATE."""
    lst = list(strings)
    old_loc = None
    try:
        old_loc = locale.setlocale(locale.LC_COLLATE)
    except Exception:
        pass
    try:
        for loc in ("vi_VN.UTF-8", "Vietnamese_Vietnam.utf8", "en_US.UTF-8"):
            try:
                locale.setlocale(locale.LC_COLLATE, loc)
                return sorted(lst, key=locale.strxfrm)
            except Exception:
                continue
        return sorted(lst, key=lambda x: (x.lower(), x))
    finally:
        if old_loc:
            try:
                locale.setlocale(locale.LC_COLLATE, old_loc)
            except Exception:
                pass


def run_import(
    excel_path: Optional[str] = None,
    output_path: Optional[str] = None,
) -> Tuple[dict, Dict[str, List[str]]]:
    excel_path = excel_path or default_excel_path()
    output_path = output_path or default_output_path()

    if not os.path.isfile(excel_path):
        alt = os.path.join(os.path.dirname(_base_dir()), "Danh-muc-Phuong-xa_moi.xlsx")
        if os.path.isfile(alt):
            excel_path = alt
            print(f"INFO: dùng file thay thế: {excel_path}")
        else:
            raise FileNotFoundError(
                f"Không tìm thấy Excel. Đặt file vào:\n  {default_excel_path()}\n"
                f"hoặc: {alt}"
            )

    wb = load_workbook(excel_path, read_only=True, data_only=True)
    if SHEET_NAME not in wb.sheetnames:
        wb.close()
        raise ValueError(
            f"Không có sheet '{SHEET_NAME}'. Các sheet có sẵn: {wb.sheetnames}"
        )
    ws = wb[SHEET_NAME]

    by_province: Dict[str, set] = defaultdict(set)
    total_rows = 0

    for row_idx in range(DATA_START_ROW, (ws.max_row or DATA_START_ROW) + 1):
        prov = _normalize_cell(ws.cell(row=row_idx, column=COL_PROVINCE).value)
        ward = _normalize_cell(ws.cell(row=row_idx, column=COL_WARD).value)
        if not prov and not ward:
            continue
        if not prov or not ward:
            continue
        by_province[prov].add(ward)
        total_rows += 1

    wb.close()

    provinces_sorted = _sort_vi(list(by_province.keys()))
    data: Dict[str, List[str]] = {}
    ward_total = 0
    for p in provinces_sorted:
        wards = _sort_vi(list(by_province[p]))
        data[p] = wards
        ward_total += len(wards)

    out = {
        "generated_from": "Danh-muc-Phuong-xa_moi.xlsx",
        "province_column": "D",
        "ward_column": "J",
        "items_count": ward_total,
        "provinces_count": len(data),
        "data": data,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    return out, data


def main():
    ap = argparse.ArgumentParser(description="Import Excel → location_master.json")
    ap.add_argument("--excel", default=None, help="Đường dẫn file Excel")
    ap.add_argument("--out", default=None, help="Đường dẫn JSON đầu ra")
    args = ap.parse_args()
    try:
        meta, data = run_import(args.excel, args.out)
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        raise SystemExit(1) from e

    print("")
    print("=== Location master import OK ===")
    print(f"Số tỉnh/thành phố: {meta['provinces_count']}")
    print(f"Số phường/xã (tổng bản ghi sau dedupe): {meta['items_count']}")
    print(f"Đã ghi: {default_output_path() if not args.out else args.out}")
    provs = _sort_vi(list(data.keys()))
    print("5 tỉnh/thành phố đầu (theo thứ tự đã sort):", ", ".join(provs[:5]) or "(trống)")

    def sample_wards(name: str, label: str):
        if name not in data:
            print(f"5 phường/xã mẫu {label}: (không có trong master)")
            return
        w = data[name][:5]
        print(f"5 phường/xã mẫu {label}: {', '.join(w)}")

    sample_wards("Thành phố Hà Nội", "Hà Nội")
    sample_wards("Thành phố Hồ Chí Minh", "TP.HCM")
    print("")


if __name__ == "__main__":
    main()
