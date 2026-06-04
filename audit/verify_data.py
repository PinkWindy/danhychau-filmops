import os
import csv

def verify_consistency():
    knowledge_dir = r"d:\Quản lý vận hành DYC"
    
    # Load masters
    dealers = set()
    with open(os.path.join(knowledge_dir, "knowledge", "dealer_account_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            dealers.add(row['dealer_id'])
            
    customers = set()
    with open(os.path.join(knowledge_dir, "knowledge", "end_customer_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            customers.add(row['customer_id'])
            
    vehicles = set()
    with open(os.path.join(knowledge_dir, "knowledge", "vehicle_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            vehicles.add(row['vehicle_model_code'])
            
    materials = set()
    with open(os.path.join(knowledge_dir, "knowledge", "material_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            materials.add(row['material_code'])
            
    job_items = set()
    with open(os.path.join(knowledge_dir, "knowledge", "job_item_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            job_items.add(row['job_item_id'])
            
    lots = set()
    with open(os.path.join(knowledge_dir, "knowledge", "lot_inventory.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lots.add(row['lot_id'])

    errors = []
    
    # 1. material_code trong norm_matrix phải tồn tại trong material_master.
    # 2. vehicle_model_code trong norm_matrix phải tồn tại trong vehicle_master.
    with open(os.path.join(knowledge_dir, "knowledge", "norm_matrix.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            m_code = row['material_code']
            v_code = row['vehicle_model_code']
            j_id = row['job_item_id']
            if m_code not in materials:
                errors.append(f"norm_matrix.csv line {i}: material_code '{m_code}' not found in material_master.csv")
            if v_code not in vehicles:
                errors.append(f"norm_matrix.csv line {i}: vehicle_model_code '{v_code}' not found in vehicle_master.csv")
            if j_id not in job_items:
                errors.append(f"norm_matrix.csv line {i}: job_item_id '{j_id}' not found in job_item_master.csv")

    # 3. parent_lot_id trong offcut_inventory phải tồn tại trong lot_inventory.
    with open(os.path.join(knowledge_dir, "knowledge", "offcut_inventory.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            parent_lot = row['parent_lot_id']
            m_code = row['material_code']
            if parent_lot not in lots:
                errors.append(f"offcut_inventory.csv line {i}: parent_lot_id '{parent_lot}' not found in lot_inventory.csv")
            if m_code not in materials:
                errors.append(f"offcut_inventory.csv line {i}: material_code '{m_code}' not found in material_master.csv")

    # 4. source_dealer_id trong end_customer_master phải tồn tại trong dealer_account_master nếu có.
    with open(os.path.join(knowledge_dir, "knowledge", "end_customer_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            d_id = row['source_dealer_id']
            if d_id and d_id not in dealers:
                errors.append(f"end_customer_master.csv line {i}: source_dealer_id '{d_id}' not found in dealer_account_master.csv")

    # 5. vehicle_profile_master phải liên kết được dealer_id, customer_id và request_id nếu có.
    with open(os.path.join(knowledge_dir, "knowledge", "vehicle_profile_master.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            d_id = row['dealer_id']
            c_id = row['customer_id']
            v_model = row['vehicle_model_code']
            if d_id and d_id not in dealers:
                errors.append(f"vehicle_profile_master.csv line {i}: dealer_id '{d_id}' not found in dealer_account_master.csv")
            if c_id and c_id not in customers:
                errors.append(f"vehicle_profile_master.csv line {i}: customer_id '{c_id}' not found in end_customer_master.csv")
            if v_model not in vehicles:
                errors.append(f"vehicle_profile_master.csv line {i}: vehicle_model_code '{v_model}' not found in vehicle_master.csv")

    # Check lot_inventory materials
    with open(os.path.join(knowledge_dir, "knowledge", "lot_inventory.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            m_code = row['material_code']
            if m_code not in materials:
                errors.append(f"lot_inventory.csv line {i}: material_code '{m_code}' not found in material_master.csv")

    # 6. Verify cutting_group_matrix.csv
    with open(os.path.join(knowledge_dir, "knowledge", "cutting_group_matrix.csv"), mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            v_code = row['vehicle_model_code']
            m_code = row['material_code']
            j_items_str = row['job_items']
            if v_code not in vehicles:
                errors.append(f"cutting_group_matrix.csv line {i}: vehicle_model_code '{v_code}' not found in vehicle_master.csv")
            if m_code not in materials:
                errors.append(f"cutting_group_matrix.csv line {i}: material_code '{m_code}' not found in material_master.csv")
            for j_item in j_items_str.split(';'):
                if j_item not in job_items:
                    errors.append(f"cutting_group_matrix.csv line {i}: job_item '{j_item}' not found in job_item_master.csv")

    print(f"=== DATABASE INTEGRITY CHECK ===")
    if errors:
        print(f"FAILED: Found {len(errors)} consistency errors:")
        for err in errors:
            print(f"- {err}")
    else:
        print("SUCCESS: All master data records are consistent!")

if __name__ == "__main__":
    verify_consistency()
