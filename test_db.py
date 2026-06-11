import sys
sys.path.append('web_demo')
from database import SessionLocal, DbVehicleProfile, DbRequest

db = SessionLocal()
veh = db.query(DbVehicleProfile).filter(DbVehicleProfile.vin_number == "JTJPB7CX304095170").first()
if veh:
    print("Found vehicle", veh.vehicle_id)
else:
    print("Not found vehicle")

req = db.query(DbRequest).filter(DbRequest.request_id == "DYC-260608-095170-C436").first()
if req:
    print("Request vehicle id:", req.vehicle_id)
    # Check if this vehicle_id is in DbVehicleProfile
    v2 = db.query(DbVehicleProfile).filter(DbVehicleProfile.vehicle_id == req.vehicle_id).first()
    if not v2:
        print("Missing from profile!")
        # Let's fix this request to use the real vehicle ID if it exists
        if veh:
            req.vehicle_id = veh.vehicle_id
            db.commit()
            print("Fixed request vehicle_id to point to real vehicle")
