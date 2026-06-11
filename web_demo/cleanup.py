import sqlite3
conn = sqlite3.connect('warehouse_demo.db')
cur = conn.cursor()
cur.execute("DELETE FROM workstreams WHERE request_id IN ('DYC-260423-012345', 'DYC-260424-012346', 'DYC-260607-012345')")
cur.execute("DELETE FROM requests WHERE request_id IN ('DYC-260423-012345', 'DYC-260424-012346', 'DYC-260607-012345')")
cur.execute("UPDATE ocr_drafts SET review_status='PENDING', confirmed_by=NULL, confirmed_at=NULL, created_request_id=NULL WHERE ocr_draft_id IN ('OCR-DRAFT-LEXUS-115-NEW', 'OCR-DRAFT-LEXUS-117-NEW')")
cur.execute("DELETE FROM job_cards WHERE workstream_id LIKE '%DYC260423012345%' OR workstream_id LIKE '%DYC260424012346%'")
conn.commit()
print('Cleaned up data.')
