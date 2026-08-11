import re
import json
import requests

def main():
    # 1. Re-create the collection `catalog`
    client_headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "application/json"
    }

    # Delete collection if it exists
    requests.delete("http://localhost:8108/collections/catalog", headers=client_headers)

    # Create collection schema
    schema = {
        "name": "catalog",
        "fields": [
            {"name": "sku", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "price", "type": "float"},
            {"name": "quantity", "type": "int32"},
            {"name": "category", "type": "string"}
        ]
    }

    create_res = requests.post("http://localhost:8108/collections", headers=client_headers, json=schema)
    if create_res.status_code != 201:
        print(f"Failed to create collection: {create_res.status_code} {create_res.text}")
        return

    # 2. Read raw products dataset
    original_docs = []
    with open('/home/user/import-pipeline/data/raw_products.jsonl', 'r') as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                original_docs.append(json.loads(line_str))

    total = len(original_docs)
    print(f"Total documents to import: {total}")

    # 3. First pass import
    import_headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "text/plain"
    }
    import_body = "\n".join(json.dumps(doc) for doc in original_docs)
    import_url = "http://localhost:8108/collections/catalog/documents/import?action=create&dirty_values=coerce_or_reject"
    
    first_pass_res = requests.post(import_url, headers=import_headers, data=import_body)
    if first_pass_res.status_code != 200:
        print(f"First pass import request failed: {first_pass_res.status_code} {first_pass_res.text}")
        return

    first_pass_lines = first_pass_res.text.strip().split("\n")
    if len(first_pass_lines) != total:
        print(f"Warning: response lines count ({len(first_pass_lines)}) does not match input count ({total})")

    imported_first_pass = 0
    repaired_candidates = []
    failed_ids = []

    for i, line in enumerate(first_pass_lines):
        if not line.strip():
            continue
        res_obj = json.loads(line)
        doc = original_docs[i]
        doc_id = doc.get("id")

        if res_obj.get("success") is True:
            imported_first_pass += 1
        else:
            # Document failed. Check if repair rules can be applied.
            has_currency_price = False
            has_missing_category = False

            # Rule 1: Currency-formatted price
            if 'price' in doc and isinstance(doc['price'], str):
                price_str = doc['price']
                try:
                    # If it's already directly numeric, no need for Rule 1 (Typesense handles this)
                    float(price_str)
                except ValueError:
                    # Not directly numeric. Let's see if we can normalize it.
                    cleaned_str = re.sub(r'[^\d.-]', '', price_str)
                    try:
                        float(cleaned_str)
                        # Yes, it can be normalized to a valid float
                        has_currency_price = True
                    except ValueError:
                        pass

            # Rule 2: Missing category
            if 'category' not in doc:
                has_missing_category = True

            # If either of these rules can be applied, it's a repair candidate
            if has_currency_price or has_missing_category:
                # Apply repairs
                repaired_doc = dict(doc)
                if has_currency_price:
                    price_str = repaired_doc['price']
                    cleaned_str = re.sub(r'[^\d.-]', '', price_str)
                    repaired_doc['price'] = float(cleaned_str)
                if has_missing_category:
                    repaired_doc['category'] = "uncategorized"
                
                repaired_candidates.append(repaired_doc)
            else:
                # Not repairable by our rules
                failed_ids.append(doc_id)

    # 4. Second pass import (only for repaired documents)
    recovered = 0
    recovered_ids = []

    if repaired_candidates:
        repaired_body = "\n".join(json.dumps(doc) for doc in repaired_candidates)
        second_pass_res = requests.post(import_url, headers=import_headers, data=repaired_body)
        if second_pass_res.status_code != 200:
            print(f"Second pass import request failed: {second_pass_res.status_code} {second_pass_res.text}")
            return

        second_pass_lines = second_pass_res.text.strip().split("\n")
        for j, line in enumerate(second_pass_lines):
            if not line.strip():
                continue
            res_obj = json.loads(line)
            repaired_doc = repaired_candidates[j]
            doc_id = repaired_doc.get("id")

            if res_obj.get("success") is True:
                recovered += 1
                recovered_ids.append(doc_id)
            else:
                failed_ids.append(doc_id)

    # 5. Compute failed count and sort ID arrays
    failed = len(failed_ids)
    recovered_ids.sort()
    failed_ids.sort()

    # Self-consistency check
    print(f"Imported First Pass: {imported_first_pass}")
    print(f"Recovered: {recovered}")
    print(f"Failed: {failed}")
    print(f"Sum: {imported_first_pass + recovered + failed} (Expected: {total})")
    
    # Query collection to verify document count
    coll_res = requests.get("http://localhost:8108/collections/catalog", headers=client_headers)
    if coll_res.status_code == 200:
        actual_count = coll_res.json().get("num_documents")
        print(f"Actual documents in collection: {actual_count} (Expected: {imported_first_pass + recovered})")
    else:
        print(f"Failed to query collection: {coll_res.status_code}")

    # Write report
    report = {
        "total": total,
        "imported_first_pass": imported_first_pass,
        "recovered": recovered,
        "failed": failed,
        "recovered_ids": recovered_ids,
        "failed_ids": failed_ids
    }

    report_path = "/home/user/import-pipeline/report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Report written to {report_path}")

if __name__ == "__main__":
    main()
