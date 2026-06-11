import sys
sys.path.append('web_demo')
from database import SessionLocal
from standard_seed_data import (
    seed_dealers,
    seed_end_customers,
    seed_vehicle_profiles,
    seed_vehicle_film_norms,
    seed_material_preferences,
    seed_inventory_lots,
    seed_inventory_offcuts,
    _seed_cutting_group_matrix
)
from film_norm_excel_import import try_import_excel_norms

db = SessionLocal()
try:
    seed_dealers(db)
    seed_end_customers(db)
    seed_vehicle_profiles(db)
    seed_vehicle_film_norms(db)
    seed_material_preferences(db)
    seed_inventory_lots(db)
    seed_inventory_offcuts(db)
    _seed_cutting_group_matrix(db)
    try_import_excel_norms(db)
    db.commit()
    print("Master data reseeded successfully.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
