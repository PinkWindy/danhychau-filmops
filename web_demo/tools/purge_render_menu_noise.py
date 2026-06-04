# -*- coding: utf-8 -*-
"""
Dọn dữ liệu demo theo menu (cập nhật warehouse_demo.db):

1) Kho cuộn LOT: xóa bản ghi có lot_id chứa LOT-SMOKE
2) Mảnh dư: xóa bản ghi có offcut_id chứa SUBLOT-DEMO
3) Khách hàng (tab Đại lý + Khách lẻ): xóa đại lý / khách có id hoặc tham chiếu khớp:
   - LOC-SMOKE
   - DEALER-ADDR
   - DEALER-AMIS
   - DEALER_BMW (tiền tố, gồm DEALER_BMW_PMH, DEALER_BMW_PHUMYHUNG, …)
   - DEALER_MERCEDES_HCM (đúng mã seed)

Trước khi xóa đại lý/khách: gỡ request → workstream → job_card → audit/notif/OCR liên quan.
"""
from __future__ import annotations

import os
import sys

_WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _WEB)

from sqlalchemy import or_

from database import (
    SessionLocal,
    DbDealer,
    DbCustomer,
    DbRequest,
    DbWorkstream,
    DbJobCard,
    DbAuditLog,
    DbNotification,
    DbOcrDraft,
    DbLotInventory,
    DbOffcutInventory,
    DbInventoryTransaction,
)


def _purge_requests(db, request_ids: list[str]) -> None:
    for rid in request_ids:
        if not rid:
            continue
        db.query(DbJobCard).filter(DbJobCard.request_id == rid).delete(synchronize_session=False)
        db.query(DbWorkstream).filter(DbWorkstream.request_id == rid).delete(synchronize_session=False)
        db.query(DbAuditLog).filter(DbAuditLog.request_id == rid).delete(synchronize_session=False)
        db.query(DbNotification).filter(DbNotification.related_id == rid).delete(synchronize_session=False)
        db.query(DbOcrDraft).filter(DbOcrDraft.created_request_id == rid).delete(synchronize_session=False)
        db.query(DbRequest).filter(DbRequest.request_id == rid).delete(synchronize_session=False)


def main() -> None:
    db = SessionLocal()
    try:
        # --- LOT-SMOKE ---
        lot_ids = [x[0] for x in db.query(DbLotInventory.lot_id).filter(DbLotInventory.lot_id.like("%LOT-SMOKE%")).all()]
        if lot_ids:
            db.query(DbInventoryTransaction).filter(
                DbInventoryTransaction.source_type == "LOT",
                DbInventoryTransaction.source_id.in_(lot_ids),
            ).delete(synchronize_session=False)
            # Mảnh dư gắn LOT smoke
            db.query(DbOffcutInventory).filter(DbOffcutInventory.parent_lot_id.in_(lot_ids)).delete(
                synchronize_session=False
            )
            db.query(DbLotInventory).filter(DbLotInventory.lot_id.in_(lot_ids)).delete(synchronize_session=False)

        # --- SUBLOT-DEMO (mảnh dư) ---
        oc_ids = [
            x[0] for x in db.query(DbOffcutInventory.offcut_id).filter(DbOffcutInventory.offcut_id.like("%SUBLOT-DEMO%")).all()
        ]
        if oc_ids:
            db.query(DbInventoryTransaction).filter(
                DbInventoryTransaction.source_type == "OFFCUT",
                DbInventoryTransaction.source_id.in_(oc_ids),
            ).delete(synchronize_session=False)
            db.query(DbOffcutInventory).filter(DbOffcutInventory.offcut_id.in_(oc_ids)).delete(synchronize_session=False)

        # --- Đại lý cần xóa (Khách hàng → Đại lý) ---
        dq = db.query(DbDealer.dealer_id).filter(
            or_(
                DbDealer.dealer_id.like("%LOC-SMOKE%"),
                DbDealer.dealer_id.like("%DEALER-ADDR%"),
                DbDealer.dealer_id.like("%DEALER-AMIS%"),
                DbDealer.dealer_id.like("DEALER_BMW%"),
                DbDealer.dealer_id == "DEALER_MERCEDES_HCM",
            )
        )
        dealer_del = [x[0] for x in dq.all()]

        # --- Khách lẻ: LOC-SMOKE + khách gắn đại lý sắp xóa ---
        cust_conds = [
            DbCustomer.customer_id.like("%LOC-SMOKE%"),
            DbCustomer.customer_id.like("%DEALER-ADDR%"),
            DbCustomer.customer_id.like("%DEALER-AMIS%"),
        ]
        if dealer_del:
            cust_conds.append(DbCustomer.source_dealer_id.in_(dealer_del))
        cust_del = [x[0] for x in db.query(DbCustomer.customer_id).filter(or_(*cust_conds)).all()]

        rids = []
        if dealer_del:
            rids += [x[0] for x in db.query(DbRequest.request_id).filter(DbRequest.dealer_id.in_(dealer_del)).all()]
        if cust_del:
            rids += [x[0] for x in db.query(DbRequest.request_id).filter(DbRequest.customer_id.in_(cust_del)).all()]
        rids = list(dict.fromkeys(rids))
        _purge_requests(db, rids)

        if cust_del:
            db.query(DbCustomer).filter(DbCustomer.customer_id.in_(cust_del)).delete(synchronize_session=False)
        if dealer_del:
            db.query(DbCustomer).filter(DbCustomer.source_dealer_id.in_(dealer_del)).update(
                {DbCustomer.source_dealer_id: None}, synchronize_session=False
            )
            db.query(DbDealer).filter(DbDealer.dealer_id.in_(dealer_del)).delete(synchronize_session=False)

        db.commit()
        print(
            "purge_render_menu_noise: OK | lots_smoke=%s sublot_demo=%s dealers=%s customers=%s requests=%s"
            % (len(lot_ids), len(oc_ids), len(dealer_del), len(cust_del), len(rids))
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
