# -*- coding: utf-8 -*-
"""
Xóa khỏi SQLite các định mức phim do smoke/script POST (không phải dữ liệu vận hành).

  norm_id LIKE 'NORM-SMOKE-%'
  norm_id LIKE 'NORM-SEED-SMOKE-%'

Chạy từ thư mục web_demo:
  python tools/purge_smoke_vehicle_norms.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
os.chdir(str(HERE))
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from sqlalchemy import or_  # noqa: E402

from database import DbVehicleFilmNorm, SessionLocal, init_db  # noqa: E402


def main() -> int:
    init_db()
    db = SessionLocal()
    try:
        rows = (
            db.query(DbVehicleFilmNorm)
            .filter(
                or_(
                    DbVehicleFilmNorm.norm_id.like("NORM-SMOKE-%"),
                    DbVehicleFilmNorm.norm_id.like("NORM-SEED-SMOKE-%"),
                )
            )
            .all()
        )
        for r in rows:
            print("DELETE", r.norm_id)
            db.delete(r)
        db.commit()
        print(f"OK: removed {len(rows)} row(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
