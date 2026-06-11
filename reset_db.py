import sys
import os
sys.path.append('web_demo')
from database import Base, engine, SessionLocal, init_db

# Drop all tables and recreate them to ensure a clean state
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

init_db()
print("Database reset successfully.")
