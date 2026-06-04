import csv
import os

def update_kb():
    knowledge_dir = r"d:\Quản lý vận hành DYC\knowledge"
    
    # 1. Update lot_inventory.csv
    lot_path = os.path.join(knowledge_dir, "lot_inventory.csv")
    lot_rows = []
    with open(lot_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        lot_headers = reader.fieldnames
        for row in reader:
            m = row["material_code"]
            if m == "PPF-X-1.52" or m == "PPF-Y-1.52":
                row["material_code"] = "T-TYPE"
            elif m == "PPF-M-1.52":
                row["material_code"] = "M-TYPE"
            elif m == "FILM-A-1.52" or m == "FILM-B-1.52":
                row["material_code"] = "JB20"
            elif m == "FILM-C-1.52":
                row["material_code"] = "RS20"
            elif m == "3M-CRYSTAL-1.52":
                row["material_code"] = "RT40"
            lot_rows.append(row)
            
    with open(lot_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=lot_headers)
        writer.writeheader()
        writer.writerows(lot_rows)
    print("Updated lot_inventory.csv")

    # 2. Update offcut_inventory.csv
    offcut_path = os.path.join(knowledge_dir, "offcut_inventory.csv")
    offcut_rows = []
    with open(offcut_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        offcut_headers = reader.fieldnames
        for row in reader:
            m = row["material_code"]
            if m == "PPF-X-1.52" or m == "PPF-Y-1.52":
                row["material_code"] = "T-TYPE"
            elif m == "PPF-M-1.52":
                row["material_code"] = "M-TYPE"
            elif m == "FILM-A-1.52" or m == "FILM-B-1.52":
                row["material_code"] = "JB20"
            elif m == "FILM-C-1.52":
                row["material_code"] = "RS20"
            elif m == "3M-CRYSTAL-1.52":
                row["material_code"] = "RT40"
            offcut_rows.append(row)
            
    with open(offcut_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=offcut_headers)
        writer.writeheader()
        writer.writerows(offcut_rows)
    print("Updated offcut_inventory.csv")

    # 3. Create cutting_group_matrix.csv
    cg_path = os.path.join(knowledge_dir, "cutting_group_matrix.csv")
    cg_headers = [
        "cut_group_id", "vehicle_model_code", "model_year", "film_type", "material_code",
        "job_items", "piece_sizes", "roll_width_cm", "cut_block_width_cm", "cut_block_length_cm",
        "deduction_length_m", "deduction_area_m2", "grouping_rule", "rotation_allowed", "status", "note"
    ]
    cg_rows = [
        {
            "cut_group_id": "CG_RX350_SIDE_REAR",
            "vehicle_model_code": "LEXUS_RX350",
            "model_year": "2026",
            "film_type": "WINDOW_FILM",
            "material_code": "JB20",
            "job_items": "JOB_FILM_SIDE;JOB_FILM_REAR",
            "piece_sizes": "92x130;60x130",
            "roll_width_cm": "152",
            "cut_block_width_cm": "152",
            "cut_block_length_cm": "130",
            "deduction_length_m": "1.430", # 1.30 * 1.1
            "deduction_area_m2": "2.174",  # 1.52 * 1.43
            "grouping_rule": "SUM_WIDTH_EQUALS_ROLL_WIDTH",
            "rotation_allowed": "true",
            "status": "ACTIVE",
            "note": "Gom kinh hau va kinh suon Lexus RX350"
        },
        {
            "cut_group_id": "CG_ES250_SIDE_REAR",
            "vehicle_model_code": "LEXUS_ES250",
            "model_year": "2026",
            "film_type": "WINDOW_FILM",
            "material_code": "JB20",
            "job_items": "JOB_FILM_SIDE;JOB_FILM_REAR",
            "piece_sizes": "92x120;60x120",
            "roll_width_cm": "152",
            "cut_block_width_cm": "152",
            "cut_block_length_cm": "120",
            "deduction_length_m": "1.320", # 1.20 * 1.1
            "deduction_area_m2": "2.006",  # 1.52 * 1.32
            "grouping_rule": "SUM_WIDTH_EQUALS_ROLL_WIDTH",
            "rotation_allowed": "true",
            "status": "ACTIVE",
            "note": "Gom kinh hau va kinh suon Lexus ES250"
        },
        {
            "cut_group_id": "CG_NX350_SIDE_REAR",
            "vehicle_model_code": "LEXUS_NX350",
            "model_year": "2026",
            "film_type": "WINDOW_FILM",
            "material_code": "RS20",
            "job_items": "JOB_FILM_SIDE;JOB_FILM_REAR",
            "piece_sizes": "90x125;62x125",
            "roll_width_cm": "152",
            "cut_block_width_cm": "152",
            "cut_block_length_cm": "125",
            "deduction_length_m": "1.375", # 1.25 * 1.1
            "deduction_area_m2": "2.090",  # 1.52 * 1.375
            "grouping_rule": "SUM_WIDTH_EQUALS_ROLL_WIDTH",
            "rotation_allowed": "true",
            "status": "ACTIVE",
            "note": "Gom kinh hau va kinh suon Lexus NX350"
        },
        {
            "cut_group_id": "CG_CAMRY_SIDE_REAR",
            "vehicle_model_code": "TOYOTA_CAMRY",
            "model_year": "2026",
            "film_type": "WINDOW_FILM",
            "material_code": "RS20",
            "job_items": "JOB_FILM_SIDE;JOB_FILM_REAR",
            "piece_sizes": "92x120;60x120",
            "roll_width_cm": "152",
            "cut_block_width_cm": "152",
            "cut_block_length_cm": "120",
            "deduction_length_m": "1.320",
            "deduction_area_m2": "2.006",
            "grouping_rule": "SUM_WIDTH_EQUALS_ROLL_WIDTH",
            "rotation_allowed": "true",
            "status": "ACTIVE",
            "note": "Gom kinh hau va kinh suon Toyota Camry"
        },
        {
            "cut_group_id": "CG_FORTUNER_SIDE_REAR",
            "vehicle_model_code": "TOYOTA_FORTUNER",
            "model_year": "2026",
            "film_type": "WINDOW_FILM",
            "material_code": "JB20",
            "job_items": "JOB_FILM_SIDE;JOB_FILM_REAR",
            "piece_sizes": "90x135;62x135",
            "roll_width_cm": "152",
            "cut_block_width_cm": "152",
            "cut_block_length_cm": "135",
            "deduction_length_m": "1.485",
            "deduction_area_m2": "2.257",
            "grouping_rule": "SUM_WIDTH_EQUALS_ROLL_WIDTH",
            "rotation_allowed": "true",
            "status": "ACTIVE",
            "note": "Gom kinh hau va kinh suon Toyota Fortuner"
        }
    ]
    with open(cg_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=cg_headers)
        writer.writeheader()
        writer.writerows(cg_rows)
    print("Created cutting_group_matrix.csv")

    # 4. Process and update norm_matrix.csv
    norm_path = os.path.join(knowledge_dir, "norm_matrix.csv")
    
    # Define mapping of old materials and keys
    # Read existing rows to parse them
    old_rows = []
    with open(norm_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            old_rows.append(row)
            
    updated_norm_rows = []
    
    # We will map each old row to the new format
    for row in old_rows:
        v_model = row["vehicle_model_code"]
        j_item = row["job_item_id"]
        m_code = row["material_code"]
        base_w = float(row["base_width_m"])
        base_l = float(row["base_length_m"])
        
        # Mapping materials
        new_m = m_code
        if m_code in ["PPF-X-1.52", "PPF-Y-1.52"]:
            new_m = "T-TYPE"
        elif m_code == "PPF-M-1.52":
            new_m = "M-TYPE"
        elif m_code in ["FILM-A-1.52", "FILM-B-1.52"]:
            new_m = "JB20"
        elif m_code == "FILM-C-1.52":
            new_m = "RS20"
        elif m_code == "3M-CRYSTAL-1.52":
            # Windshield is RT40, side/rear is JB20
            if "WINDSHIELD" in j_item:
                new_m = "RT40"
            else:
                new_m = "JB20"
                
        # Determine safety margin
        if new_m in ["T-TYPE", "M-TYPE", "PET-TYPE", "TPU-TYPE", "S-TYPE"]:
            safety_margin = 5
        else:
            safety_margin = 10
            
        # Determine piece sizes and cutting group info
        piece_w_cm = int(base_w * 100)
        piece_l_cm = int(base_l * 100)
        cut_group = ""
        is_grouped = "false"
        
        # Specific overrides for grouped cuts to match our matrix
        if v_model == "LEXUS_RX350" and j_item == "JOB_FILM_SIDE":
            new_m = "JB20"
            piece_w_cm = 92
            piece_l_cm = 130
            cut_group = "CG_RX350_SIDE_REAR"
            is_grouped = "true"
        elif v_model == "LEXUS_ES250" and j_item == "JOB_FILM_SIDE":
            new_m = "JB20"
            piece_w_cm = 92
            piece_l_cm = 120
            cut_group = "CG_ES250_SIDE_REAR"
            is_grouped = "true"
            
        req_width = base_w
        req_length = round(base_l * (1 + safety_margin / 100.0), 3)
        req_area = round(req_width * req_length, 3)
        tolerance = safety_margin
        
        new_row = {
            "vehicle_model_code": v_model,
            "job_item_id": j_item,
            "material_code": new_m,
            "base_width_m": f"{base_w:.2f}",
            "base_length_m": f"{base_l:.2f}",
            "safety_margin_percent": str(safety_margin),
            "required_width_m": f"{req_width:.2f}",
            "required_length_m": f"{req_length:.3f}",
            "required_area_m2": f"{req_area:.3f}",
            "tolerance_percent": str(tolerance),
            "piece_width_cm": str(piece_w_cm),
            "piece_length_cm": str(piece_l_cm),
            "cut_group_id": cut_group,
            "is_grouped_cut": is_grouped,
            "status": "ACTIVE",
            "note": "Gom cat theo kho phim" if is_grouped == "true" else "Dinh muc le"
        }
        updated_norm_rows.append(new_row)
        
    # Add Rear items to norm_matrix to match the cutting groups!
    # 1. Lexus RX350 Rear
    updated_norm_rows.append({
        "vehicle_model_code": "LEXUS_RX350",
        "job_item_id": "JOB_FILM_REAR",
        "material_code": "JB20",
        "base_width_m": "1.52",
        "base_length_m": "1.30",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.430",
        "required_area_m2": "2.174",
        "tolerance_percent": "10",
        "piece_width_cm": "60",
        "piece_length_cm": "130",
        "cut_group_id": "CG_RX350_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    
    # 2. Lexus ES250 Rear
    updated_norm_rows.append({
        "vehicle_model_code": "LEXUS_ES250",
        "job_item_id": "JOB_FILM_REAR",
        "material_code": "JB20",
        "base_width_m": "1.52",
        "base_length_m": "1.20",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.320",
        "required_area_m2": "2.006",
        "tolerance_percent": "10",
        "piece_width_cm": "60",
        "piece_length_cm": "120",
        "cut_group_id": "CG_ES250_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    
    # 3. Lexus NX350 Rear & Side (add Rear, and add Side)
    updated_norm_rows.append({
        "vehicle_model_code": "LEXUS_NX350",
        "job_item_id": "JOB_FILM_SIDE",
        "material_code": "RS20",
        "base_width_m": "1.52",
        "base_length_m": "1.25",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.375",
        "required_area_m2": "2.090",
        "tolerance_percent": "10",
        "piece_width_cm": "90",
        "piece_length_cm": "125",
        "cut_group_id": "CG_NX350_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    updated_norm_rows.append({
        "vehicle_model_code": "LEXUS_NX350",
        "job_item_id": "JOB_FILM_REAR",
        "material_code": "RS20",
        "base_width_m": "1.52",
        "base_length_m": "1.25",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.375",
        "required_area_m2": "2.090",
        "tolerance_percent": "10",
        "piece_width_cm": "62",
        "piece_length_cm": "125",
        "cut_group_id": "CG_NX350_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    
    # 4. Toyota Camry Side & Rear
    updated_norm_rows.append({
        "vehicle_model_code": "TOYOTA_CAMRY",
        "job_item_id": "JOB_FILM_SIDE",
        "material_code": "RS20",
        "base_width_m": "1.52",
        "base_length_m": "1.20",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.320",
        "required_area_m2": "2.006",
        "tolerance_percent": "10",
        "piece_width_cm": "92",
        "piece_length_cm": "120",
        "cut_group_id": "CG_CAMRY_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    updated_norm_rows.append({
        "vehicle_model_code": "TOYOTA_CAMRY",
        "job_item_id": "JOB_FILM_REAR",
        "material_code": "RS20",
        "base_width_m": "1.52",
        "base_length_m": "1.20",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.320",
        "required_area_m2": "2.006",
        "tolerance_percent": "10",
        "piece_width_cm": "60",
        "piece_length_cm": "120",
        "cut_group_id": "CG_CAMRY_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })

    # 5. Toyota Fortuner Side & Rear
    updated_norm_rows.append({
        "vehicle_model_code": "TOYOTA_FORTUNER",
        "job_item_id": "JOB_FILM_SIDE",
        "material_code": "JB20",
        "base_width_m": "1.52",
        "base_length_m": "1.35",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.485",
        "required_area_m2": "2.257",
        "tolerance_percent": "10",
        "piece_width_cm": "90",
        "piece_length_cm": "135",
        "cut_group_id": "CG_FORTUNER_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })
    updated_norm_rows.append({
        "vehicle_model_code": "TOYOTA_FORTUNER",
        "job_item_id": "JOB_FILM_REAR",
        "material_code": "JB20",
        "base_width_m": "1.52",
        "base_length_m": "1.35",
        "safety_margin_percent": "10",
        "required_width_m": "1.52",
        "required_length_m": "1.485",
        "required_area_m2": "2.257",
        "tolerance_percent": "10",
        "piece_width_cm": "62",
        "piece_length_cm": "135",
        "cut_group_id": "CG_FORTUNER_SIDE_REAR",
        "is_grouped_cut": "true",
        "status": "ACTIVE",
        "note": "Gom cat theo kho phim"
    })

    # Write norm_matrix.csv
    norm_headers = [
        "vehicle_model_code", "job_item_id", "material_code", "base_width_m", "base_length_m",
        "safety_margin_percent", "required_width_m", "required_length_m", "required_area_m2",
        "tolerance_percent", "piece_width_cm", "piece_length_cm", "cut_group_id", "is_grouped_cut", "status", "note"
    ]
    with open(norm_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=norm_headers)
        writer.writeheader()
        writer.writerows(updated_norm_rows)
    print("Updated norm_matrix.csv")

if __name__ == "__main__":
    update_kb()
