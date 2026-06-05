# -*- coding: utf-8 -*-
"""
Xóa toàn bộ khách lẻ có customer_id bắt đầu bằng CUS-AMIS- (dữ liệu smoke),
kèm request / workstream / job card / audit / notif / ocr_draft liên quan.

Chạy từ thư mục web_demo:
  python tools/purge_cus_amis_customers.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
os.chdir(str(HERE))
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from standard_seed_data import _purge_amis_smoke_end_customers  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402


def main() -> int:
    init_db()
    db = SessionLocal()
    try:
        n = _purge_amis_smoke_end_customers(db)
        db.commit()
        print(f"OK: removed {n} customer(s) matching CUS-AMIS-%")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
