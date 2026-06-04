# -*- coding: utf-8 -*-
"""
Reset SQLite demo warehouse_demo.db + seed chuẩn.
CLI: chạy từ thư mục web_demo —  python reset_database_full_seed.py
API: POST /api/admin/reset-database-standard-seed (khi bật env) gọi run_full_reset_sequence().
"""
from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

WEB_DEMO_DIR = Path(__file__).resolve().parent


def wipe_all_demo_tables(db: Session) -> None:
    """Xóa toàn bộ dòng khi không unlink được file SQLite (process khác đang giữ lock)."""
    from sqlalchemy import text

    from database import Base

    db.execute(text("PRAGMA foreign_keys=OFF"))
    try:
        for tbl in reversed(Base.metadata.sorted_tables):
            db.execute(text(f'DELETE FROM "{tbl.name}"'))
    finally:
        db.execute(text("PRAGMA foreign_keys=ON"))
    db.commit()


def run_full_reset_sequence(web_demo_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Backup warehouse_demo.db, xóa db+wals (hoặc wipe bảng nếu Windows lock), init_db(), seed.
    """
    base = Path(web_demo_dir or WEB_DEMO_DIR).resolve()
    os.chdir(str(base))
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))

    from sqlalchemy.orm import close_all_sessions

    from database import DATABASE_PATH, SessionLocal, engine, init_db
    from standard_seed_data import seed_all_demo_data, summarize_table_counts

    backups = base / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    db_path = Path(DATABASE_PATH)
    backup_path = None
    if db_path.is_file():
        backup_path = backups / f"warehouse_demo_backup_{stamp}.db"
        shutil.copy2(db_path, backup_path)

    try:
        close_all_sessions()
    except Exception:
        pass
    engine.dispose()

    file_reset_ok = True
    try:
        for p in (db_path, Path(str(db_path) + "-wal"), Path(str(db_path) + "-shm")):
            if p.is_file():
                p.unlink()
    except OSError:
        file_reset_ok = False

    init_db()
    db = SessionLocal()
    try:
        try:
            if not file_reset_ok:
                wipe_all_demo_tables(db)
            seed_all_demo_data(db)
            db.commit()
        except Exception:
            db.rollback()
            raise
        counts = summarize_table_counts(db)
    finally:
        db.close()

    return {
        "backup_path": str(backup_path) if backup_path else None,
        "counts": counts,
        "file_deleted": file_reset_ok,
        "table_wipe_fallback": not file_reset_ok,
    }


def main() -> int:
    if Path.cwd().resolve() != WEB_DEMO_DIR:
        print(f"ERROR: Phải chạy từ thư mục web_demo (cwd={Path.cwd()}), expected={WEB_DEMO_DIR}")
        return 1
    out = run_full_reset_sequence(WEB_DEMO_DIR)
    print(f"Backup: {out.get('backup_path')}")
    if out.get("table_wipe_fallback"):
        print("NOTE: Không xóa được file .db (đang bị lock) — đã xóa dữ liệu bằng DELETE toàn bộ bảng.")
    print("")
    print("Summary counts:")
    for k in sorted((out.get("counts") or {}).keys()):
        print(f"  {k}: {out['counts'][k]}")
    print("")
    print("DATABASE RESET & FULL STANDARD SEED COMPLETED")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
