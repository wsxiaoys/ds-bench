#!/usr/bin/env python3
import json
import os
import sys
import requests

TYPESENSE_URL = "http://localhost:8108"
API_KEY = "xyz"
HEADERS = {
    "X-TYPESENSE-API-KEY": API_KEY
}
COLLECTION_NAME = "catalog"
INPUT_FILE = "/home/user/import-pipeline/data/raw_products.jsonl"
REPORT_FILE = "/home/user/import-pipeline/report.json"

def main():
    # 1. Read input dataset
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file {INPUT_FILE} not found.", file=sys.stderr)
        sys.exit(1)
        
    raw_documents = []
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                raw_documents.append(json.loads(line_str))
                
    total_docs = len(raw_documents)
    print(f"Loaded {total_docs} documents from input dataset.")
    
    # 2. Recreate collection (Idempotency)
    # Delete if exists
    delete_url = f"{TYPESENSE_URL}/collections/{COLLECTION_NAME}"
    res = requests.delete(delete_url, headers=HEADERS)
    if res.status_code not in [200, 404]:
        print(f"Error deleting collection: {res.status_code} {res.text}", file=sys.stderr)
        sys.exit(1)
        
    # Create schema
    schema = {
        "name": COLLECTION_NAME,
        "fields": [
            {"name": "sku", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "price", "type": "float"},
            {"name": "quantity", "type": "int32"},
            {"name": "category", "type": "string"}
        ]
    }
    create_url = f"{TYPESENSE_URL}/collections"
    res = requests.post(create_url, headers=HEADERS, json=schema)
    if res.status_code != 201:
        print(f"Error creating collection: {res.status_code} {res.text}", file=sys.stderr)
        sys.exit(1)
    print("Collection created successfully.")
    
    # 3. First-pass import
    # Convert all raw documents to JSONL
    payload_first_pass = "\n".join(json.dumps(doc) for doc in raw_documents)
    import_url = f"{TYPESENSE_URL}/collections/{COLLECTION_NAME}/documents/import"
    params = {
        "action": "create",
        "dirty_values": "coerce_or_reject"
    }
    
    res = requests.post(import_url, headers=HEADERS, params=params, data=payload_first_pass)
    if res.status_code != 200:
        print(f"Error during first-pass import: {res.status_code} {res.text}", file=sys.stderr)
        sys.exit(1)
        
    response_lines_first_pass = res.text.strip().split("\n")
    if len(response_lines_first_pass) != total_docs:
        print(f"Error: Expected {total_docs} response lines, got {len(response_lines_first_pass)}", file=sys.stderr)
        sys.exit(1)
        
    # 4. Parse first-pass results and separate success/fail
    imported_first_pass_count = 0
    failed_first_pass_docs = [] # list of (doc, error_msg)
    
    for doc, resp_line in zip(raw_documents, response_lines_first_pass):
        resp_obj = json.loads(resp_line)
        if resp_obj.get("success") is True:
            imported_first_pass_count += 1
        else:
            failed_first_pass_docs.append((doc, resp_obj.get("error", "Unknown error")))
            
    print(f"First-pass import finished. Success: {imported_first_pass_count}, Failed: {len(failed_first_pass_docs)}")
    
    # 5. Apply repairs and prepare second-pass import
    repaired_docs = [] # list of repaired docs to re-import
    unrepaired_ids = [] # ids of docs that could not be repaired
    
    for doc, error_msg in failed_first_pass_docs:
        doc_id = doc.get("id")
        repaired = False
        new_doc = doc.copy()
        
        # Repair 1: Currency-formatted price
        price = new_doc.get("price")
        if isinstance(price, str):
            try:
                float(price)
                # Directly numeric, no repair needed (though it shouldn't have failed unless there's another issue)
            except ValueError:
                # Let's clean the string
                cleaned = price
                for symbol in ["$", "€", "£", "¥"]:
                    cleaned = cleaned.replace(symbol, "")
                cleaned = cleaned.replace(",", "")
                try:
                    val = float(cleaned)
                    new_doc["price"] = val
                    repaired = True
                except ValueError:
                    pass
                    
        # Repair 2: Missing category
        if "category" not in new_doc:
            new_doc["category"] = "uncategorized"
            repaired = True
            
        if repaired:
            repaired_docs.append(new_doc)
        else:
            unrepaired_ids.append(doc_id)
            
    print(f"Applied repairs to {len(repaired_docs)} documents. {len(unrepaired_ids)} documents could not be repaired.")
    
    # 6. Second-pass import for repaired documents
    recovered_ids = []
    failed_ids = list(unrepaired_ids) # starts with those we couldn't even repair
    
    if repaired_docs:
        payload_second_pass = "\n".join(json.dumps(doc) for doc in repaired_docs)
        res = requests.post(import_url, headers=HEADERS, params=params, data=payload_second_pass)
        if res.status_code != 200:
            print(f"Error during second-pass import: {res.status_code} {res.text}", file=sys.stderr)
            sys.exit(1)
            
        response_lines_second_pass = res.text.strip().split("\n")
        if len(response_lines_second_pass) != len(repaired_docs):
            print(f"Error: Expected {len(repaired_docs)} response lines in second pass, got {len(response_lines_second_pass)}", file=sys.stderr)
            sys.exit(1)
            
        for doc, resp_line in zip(repaired_docs, response_lines_second_pass):
            resp_obj = json.loads(resp_line)
            doc_id = doc.get("id")
            if resp_obj.get("success") is True:
                recovered_ids.append(doc_id)
            else:
                print(f"Repaired document {doc_id} failed to import again: {resp_obj.get('error')}")
                failed_ids.append(doc_id)
                
    # 7. Final counts and sorting
    recovered_count = len(recovered_ids)
    failed_count = len(failed_ids)
    
    # Sort the ID lists ascending
    recovered_ids.sort()
    failed_ids.sort()
    
    # Verify internal consistency
    assert total_docs == imported_first_pass_count + recovered_count + failed_count, "Internal consistency check failed!"
    
    # Verify final document count in Typesense
    res = requests.get(f"{TYPESENSE_URL}/collections/{COLLECTION_NAME}", headers=HEADERS)
    if res.status_code == 200:
        actual_count = res.json().get("num_documents", 0)
        expected_count = imported_first_pass_count + recovered_count
        print(f"Typesense collection doc count: {actual_count} (Expected: {expected_count})")
        if actual_count != expected_count:
            print(f"Warning: Typesense count {actual_count} does not match expected {expected_count}!", file=sys.stderr)
    else:
        print(f"Warning: Could not fetch collection stats: {res.status_code} {res.text}", file=sys.stderr)
        
    # 8. Write report
    report = {
        "total": total_docs,
        "imported_first_pass": imported_first_pass_count,
        "recovered": recovered_count,
        "failed": failed_count,
        "recovered_ids": recovered_ids,
        "failed_ids": failed_ids
    }
    
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    print(f"Report written to {REPORT_FILE}")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
