import re

main_path = 'd:/Quản lý vận hành DYC/web_demo/main.py'
with open(main_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update _update_request_status_from_workstreams
old_update = """    if all(s == "CLOSED" for s in statuses):
        req.status = "CLOSED"
    elif all(s in ("CLOSED", "COMPLETED") for s in statuses):"""
    
new_update = """    if all(s in ("CLOSED", "CANCELLED") for s in statuses):
        req.status = "CLOSED"
    elif all(s in ("CLOSED", "COMPLETED", "CANCELLED") for s in statuses):"""

if old_update in content:
    content = content.replace(old_update, new_update)

# 2. Add /api/workstreams/{ws_id}/cancel
if "@app.post(\"/api/workstreams/{ws_id}/cancel\")" not in content:
    insert_idx = content.find("@app.post(\"/api/workstreams/{ws_id}/complete\")")
    if insert_idx != -1:
        new_api = """@app.post("/api/workstreams/{ws_id}/cancel")
def cancel_workstream(ws_id: str, data: dict = None, db: Session = Depends(get_db)):
    ws = db.query(DbWorkstream).filter(DbWorkstream.workstream_id == ws_id).first()
    if not ws: raise HTTPException(404, "Workstream not found")
    if ws.status in ("CLOSED", "COMPLETED", "CANCELLED"):
        raise HTTPException(400, f"Không thể hủy luồng ở trạng thái: {ws.status}")

    reason = (data or {}).get("reason", "Hủy theo yêu cầu")
    actor = (data or {}).get("actor", "QL-002")

    _audit(db, ws.request_id, "WORKSTREAM_CANCELLED", "WORKSTREAM", ws_id,
           ws.status, "CANCELLED", reason, actor, ws_id, getattr(ws, "workstream_type", ""))

    ws.status = "CANCELLED"

    # Free soft locks
    from database import DbLotInventory, DbOffcutInventory, DbJobCard
    lot_locks = db.query(DbLotInventory).filter(DbLotInventory.locked_by_workstream_id == ws_id).all()
    for l in lot_locks:
        l.is_locked = False
        l.locked_by_request_id = None
        l.locked_by_workstream_id = None

    offcut_locks = db.query(DbOffcutInventory).filter(DbOffcutInventory.locked_by_workstream_id == ws_id).all()
    for o in offcut_locks:
        o.is_locked = False
        o.locked_by_request_id = None
        o.locked_by_workstream_id = None

    # Update Job Card
    if ws.job_card_id:
        jc = db.query(DbJobCard).filter(DbJobCard.job_card_id == ws.job_card_id).first()
        if jc:
            jc.status = "CANCELLED"

    # Update Request Status
    req = db.query(DbRequest).filter(DbRequest.request_id == ws.request_id).first()
    if req:
        _update_request_status_from_workstreams(db, req)

    db.commit()
    return {"status": "success", "detail": "Đã hủy luồng thi công."}

"""
        content = content[:insert_idx] + new_api + content[insert_idx:]

with open(main_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched main.py successfully!")
