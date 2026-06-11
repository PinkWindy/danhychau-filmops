import sys
sys.path.append('web_demo')
from database import SessionLocal, DbRequest, DbWorkstream, DbJobCard, DbOcrDraft, DbAuditLog

db = SessionLocal()
db.query(DbRequest).delete()
db.query(DbWorkstream).delete()
db.query(DbJobCard).delete()
db.query(DbOcrDraft).delete()
db.query(DbAuditLog).delete()
db.commit()
print("Cleared all transactions.")
