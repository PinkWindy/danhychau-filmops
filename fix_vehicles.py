import sys
import datetime
sys.path.append('web_demo')
from database import SessionLocal, DbRequest, DbVehicleProfile

db = SessionLocal()
reqs = db.query(DbRequest).all()
for req in reqs:
    veh = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == req.vehicle_id).first()
    if not veh:
        print(f"Creating missing vehicle for req: {req.request_id}, veh: {req.vehicle_id}")
        new_veh = DbVehicleProfile(
            vehicle_id=req.vehicle_id,
            vin_number=req.vin_number,
            vin_masked=req.vin_masked or req.vin_number,
            vehicle_model_code=req.vehicle_model_code,
            model_name=req.model_name,
            customer_id=req.customer_id,
            dealer_id=req.dealer_id,
            created_from_request_id=req.request_id,
            created_at=datetime.datetime.now().isoformat() + "Z"
        )
        db.add(new_veh)
db.commit()
print("Done fixing missing vehicles.")
