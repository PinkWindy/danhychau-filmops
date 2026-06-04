import csv
import os

def update_norm():
    norm_path = r"d:\Quản lý vận hành DYC\knowledge\norm_matrix.csv"
    
    rows = []
    headers = [
        "vehicle_model_code", "job_item_id", "material_code", "base_width_m", "base_length_m",
        "safety_margin_percent", "required_width_m", "required_length_m", "required_area_m2",
        "tolerance_percent", "note", "status"
    ]
    
    # Read existing
    with open(norm_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
            
    # Process
    updated_rows = []
    seen_keys = set()
    duplicates = []
    
    for i, row in enumerate(rows, start=1):
        v_model = row["vehicle_model_code"]
        j_item = row["job_item_id"]
        m_code = row["material_code"]
        
        # Check duplicate key
        key = (v_model, j_item, m_code)
        if key in seen_keys:
            duplicates.append(key)
        seen_keys.add(key)
        
        base_width = float(row["base_width_m"])
        base_length = float(row["base_length_m"])
        
        # Determine safety margin
        if m_code.startswith("PPF"):
            safety_margin = 5
        else:
            safety_margin = 10
            
        req_width = base_width
        req_length = round(base_length * (1 + safety_margin / 100.0), 3)
        req_area = round(req_width * req_length, 3)
        tolerance = safety_margin
        note = "Dinh muc chuan"
        status = "ACTIVE"
        
        updated_row = {
            "vehicle_model_code": v_model,
            "job_item_id": j_item,
            "material_code": m_code,
            "base_width_m": row["base_width_m"],
            "base_length_m": row["base_length_m"],
            "safety_margin_percent": str(safety_margin),
            "required_width_m": str(req_width),
            "required_length_m": f"{req_length:.3f}",
            "required_area_m2": f"{req_area:.3f}",
            "tolerance_percent": str(tolerance),
            "note": note,
            "status": status
        }
        updated_rows.append(updated_row)
        
    print(f"Total rows processed: {len(updated_rows)}")
    if duplicates:
        print(f"DUPLICATES FOUND: {duplicates}")
    else:
        print("NO DUPLICATES FOUND!")
        
    # Write back
    with open(norm_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for u_row in updated_rows:
            writer.writerow(u_row)
            
    # Verify no nulls
    null_found = False
    for u_row in updated_rows:
        for k, v in u_row.items():
            if v is None or v == "":
                null_found = True
                print(f"Null found in key {k} for row {u_row}")
    if not null_found:
        print("NO NULL VALUES FOUND!")

if __name__ == "__main__":
    update_norm()
