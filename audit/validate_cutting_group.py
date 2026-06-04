import os
import csv
import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def validate_cutting_group_matrix():
    workspace_dir = r"d:\Quản lý vận hành DYC"
    schema_path = os.path.join(workspace_dir, "schemas", "cutting-group-schema.json")
    csv_path = os.path.join(workspace_dir, "knowledge", "cutting_group_matrix.csv")
    
    # 1. Load schema to verify rules
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)
    
    required_fields = schema.get("required", [])
    
    # Allowed enums from schema
    film_types = set(schema["properties"]["film_type"]["enum"])
    grouping_rules = set(schema["properties"]["grouping_rule"]["enum"])
    statuses = set(schema["properties"]["status"]["enum"])
    
    print("=== START VALIDATION OF CUTTING GROUP MATRIX ===")
    print(f"Schema Path: {schema_path}")
    print(f"CSV Path: {csv_path}")
    print(f"Required fields from schema: {required_fields}")
    print(f"Allowed film_types: {film_types}")
    print(f"Allowed grouping_rules: {grouping_rules}")
    print(f"Allowed statuses: {statuses}")
    print("-" * 50)
    
    errors = []
    seen_cut_group_ids = set()
    
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for line_num, row in enumerate(reader, start=2):
            # Check unique cut_group_id
            cg_id = row.get("cut_group_id")
            if not cg_id:
                errors.append(f"Line {line_num}: cut_group_id is missing or empty.")
            else:
                if cg_id in seen_cut_group_ids:
                    errors.append(f"Line {line_num}: Duplicate cut_group_id '{cg_id}' found.")
                seen_cut_group_ids.add(cg_id)
            
            # Check required fields are not null/empty
            for field in required_fields:
                val = row.get(field)
                if val is None or val.strip() == "":
                    errors.append(f"Line {line_num}: Required field '{field}' is null or empty.")
            
            # Check film_type
            ft = row.get("film_type")
            if ft and ft not in film_types:
                errors.append(f"Line {line_num}: film_type '{ft}' is not valid (must be PPF or WINDOW_FILM).")
            
            # Check grouping_rule
            gr = row.get("grouping_rule")
            if gr and gr not in grouping_rules:
                errors.append(f"Line {line_num}: grouping_rule '{gr}' is not valid.")
                
            # Check status
            st = row.get("status")
            if st and st not in statuses:
                errors.append(f"Line {line_num}: status '{st}' is not valid (must be ACTIVE or INACTIVE).")
            
            # Check model_year limits (integer, 2000-2100)
            my_str = row.get("model_year")
            if my_str:
                try:
                    my_val = int(my_str)
                    if my_val < 2000 or my_val > 2100:
                        errors.append(f"Line {line_num}: model_year {my_val} is out of bounds [2000, 2100].")
                except ValueError:
                    errors.append(f"Line {line_num}: model_year '{my_str}' cannot be converted to integer.")
            
            # Check deduction_area_m2 calculation: 
            # deduction_area_m2 = (cut_block_width_cm / 100) * deduction_length_m
            w_str = row.get("cut_block_width_cm")
            l_str = row.get("deduction_length_m")
            a_str = row.get("deduction_area_m2")
            if w_str and l_str and a_str:
                try:
                    w = float(w_str)
                    l = float(l_str)
                    a = float(a_str)
                    expected_a = (w / 100.0) * l
                    diff = abs(a - expected_a)
                    if diff > 0.001:
                        errors.append(f"Line {line_num}: deduction_area_m2 calculation mismatch. Got {a}, expected {expected_a:.4f} (diff {diff:.4f} > 0.001).")
                except ValueError:
                    errors.append(f"Line {line_num}: Non-numeric value found in cut_block_width_cm, deduction_length_m, or deduction_area_m2.")
                    
    if errors:
        print(f"RESULT: FAILED. Found {len(errors)} errors:")
        for err in errors:
            print(f"- {err}")
    else:
        print("RESULT: SUCCESS. All validation checks passed!")
    print("=== END VALIDATION OF CUTTING GROUP MATRIX ===")

if __name__ == "__main__":
    validate_cutting_group_matrix()
