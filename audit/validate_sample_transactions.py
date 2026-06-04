import os
import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def validate_sample():
    workspace_dir = r"d:\Quản lý vận hành DYC"
    schema_path = os.path.join(workspace_dir, "schemas", "inventory-transaction-schema.json")
    sample_path = os.path.join(workspace_dir, "outputs", "sample-05-inventory-transaction-log.json")
    
    print("=== START VALIDATION OF SAMPLE TRANSACTIONS ===")
    print(f"Schema Path: {schema_path}")
    print(f"Sample Path: {sample_path}")
    
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_data = json.load(f)
            
        with open(sample_path, "r", encoding="utf-8") as f:
            sample_data = json.load(f)
            
        import jsonschema
        validator = jsonschema.Draft7Validator(schema_data)
        
        errors_found = 0
        for idx, txn in enumerate(sample_data):
            errors = sorted(validator.iter_errors(txn), key=lambda e: e.path)
            if errors:
                print(f"Transaction index {idx} (ID: {txn.get('transaction_id')}) is INVALID:")
                for err in errors:
                    print(f"  - Path: {list(err.path)} | Message: {err.message}")
                errors_found += len(errors)
            else:
                print(f"Transaction index {idx} (ID: {txn.get('transaction_id')}) is VALID.")
                
        if errors_found:
            print(f"RESULT: FAILED. Found {errors_found} errors across transactions.")
            sys.exit(1)
        else:
            print("RESULT: SUCCESS. All sample transactions are valid!")
    except ImportError:
        print("INFO: jsonschema package not installed, skipped advanced jsonschema validation check.")
    except Exception as e:
        print(f"RESULT: FAILED. Error: {e}")
        sys.exit(1)
    print("=== END VALIDATION ===")

if __name__ == "__main__":
    validate_sample()
