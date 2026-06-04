import os
import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def validate_schema_format():
    workspace_dir = r"d:\Quản lý vận hành DYC"
    schema_path = os.path.join(workspace_dir, "schemas", "inventory-transaction-schema.json")
    
    print("=== START VALIDATION OF INVENTORY TRANSACTION SCHEMA ===")
    print(f"Schema Path: {schema_path}")
    
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_data = json.load(f)
        print("SUCCESS: File is valid JSON.")
        
        # Test draft-07 compatibility by basic checks
        if schema_data.get("$schema") == "http://json-schema.org/draft-07/schema#":
            print("SUCCESS: Declared draft-07 schema.")
        else:
            print("WARNING: Non-standard or missing draft-07 schema header.")
            
        print(f"Title: {schema_data.get('title')}")
        print(f"Properties: {list(schema_data.get('properties', {}).keys())}")
        print(f"Required Fields: {schema_data.get('required', [])}")
        print(f"Conditional validation conditions (allOf): {len(schema_data.get('allOf', []))}")
        
        # Check if we can import jsonschema and validate with draft7 validator
        try:
            import jsonschema
            jsonschema.Draft7Validator.check_schema(schema_data)
            print("SUCCESS: jsonschema.Draft7Validator confirmed the schema is valid Draft-07.")
        except ImportError:
            print("INFO: jsonschema package not installed, skipped advanced jsonschema compilation check.")
        except Exception as ex:
            print(f"FAILED: jsonschema check failed with: {ex}")
            sys.exit(1)
            
        print("RESULT: SUCCESS. The schema file structure is correct!")
    except Exception as e:
        print(f"RESULT: FAILED. Error: {e}")
        sys.exit(1)
    print("=== END VALIDATION ===")

if __name__ == "__main__":
    validate_schema_format()
