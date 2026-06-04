# -*- coding: utf-8 -*-
"""
Dọn dữ liệu demo (chạy một lần, cập nhật warehouse_demo.db):

1) Xóa đại lý có dealer_id chứa DEALER-SMOKE-
2) Xóa khách lẻ có customer_id chứa CUS-SMOKE-
3) Xóa định mức phim (vehicle_film_norms) status = INACTIVE
4) Xóa toàn bộ vehicle_profiles + request/workstream/job_card liên quan

Thứ tự xóa tránh orphan FK logic trong app.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_

from database import (
    SessionLocal,
    DbDealer,
    DbCustomer,
    DbVehicleProfile,
    DbVehicleFilmNorm,
    DbRequest,
    DbWorkstream,
    DbJobCard,
    DbAuditLog,
    DbNotification,
    DbOcrDraft,
)


def main() -> None:
    db = SessionLocal()
    try:
        # --- 1) Request liên quan smoke dealer / smoke customer ---
        req_smoke = (
            db.query(DbRequest.request_id)
            .filter(
                or_(
                    DbRequest.dealer_id.like("%DEALER-SMOKE-%"),
                    DbRequest.customer_id.like("%CUS-SMOKE-%"),
                )
            )
            .all()
        )
        rid_smoke = [r[0] for r in req_smoke]

        # --- 2) Mọi request gắn vehicle sẽ bị xóa khi xóa hết vehicle_profiles ---
        all_vids = [x[0] for x in db.query(DbVehicleProfile.vehicle_id).all()]
        req_by_vehicle = (
            db.query(DbRequest.request_id).filter(DbRequest.vehicle_id.in_(all_vids)).all()
            if all_vids
            else []
        )
        rid_vehicle = [r[0] for r in req_by_vehicle]

        rid_all = list(dict.fromkeys(rid_smoke + rid_vehicle))

        for rid in rid_all:
            db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete(synchronize_session=False)
            db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete(synchronize_session=False)
            db.query(DbAuditLog).filter(DbAuditLog.request_id == rid).delete(synchronize_session=False)
            db.query(DbNotification).filter(DbNotification.related_id == rid).delete(synchronize_session=False)
            db.query(DbOcrDraft).filter(DbOcrDraft.created_request_id == rid).delete(synchronize_session=False)
            db.query(DbRequest).filter(DbRequest.request_id == rid).delete(synchronize_session=False)

        # --- 3) Xóa định mức INACTIVE ---
        db.query(DbVehicleFilmNorm).filter(DbVehicleFilmNorm.status == "INACTIVE").delete(
            synchronize_session=False
        )

        # --- 4) Xóa toàn bộ hồ sơ xe ---
        db.query(DbVehicleProfile).delete(synchronize_session=False)

        # Request còn trỏ vehicle_id đã mất (orphan)
        rem = [x[0] for x in db.query(DbRequest.request_id).filter(DbRequest.vehicle_id.isnot(None)).all()]
        for rid in rem:
            if not rid:
                continue
            db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete(synchronize_session=False)
            db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete(synchronize_session=False)
            db.query(DbAuditLog).filter(DbAuditLog.request_id == rid).delete(synchronize_session=False)
            db.query(DbNotification).filter(DbNotification.related_id == rid).delete(synchronize_session=False)
            db.query(DbOcrDraft).filter(DbOcrDraft.created_request_id == rid).delete(synchronize_session=False)
            db.query(DbRequest).filter(DbRequest.request_id == rid).delete(synchronize_session=False)

        # --- 5) Xóa khách / đại lý smoke (sau khi request đã gỡ) ---
        db.query(DbDealer).filter(DbDealer.dealer_id.like("%DEALER-SMOKE-%")).delete(synchronize_session=False)
        db.query(DbCustomer).filter(DbCustomer.customer_id.like("%CUS-SMOKE-%")).delete(synchronize_session=False)

        # Gỡ tham chiếu source_dealer_id trỏ tới dealer smoke (nếu còn)
        db.query(DbCustomer).filter(DbCustomer.source_dealer_id.like("%DEALER-SMOKE-%")).update(
            {DbCustomer.source_dealer_id: None}, synchronize_session=False
        )

        db.commit()
        print("purge_demo_smoke_and_vehicles: OK")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
