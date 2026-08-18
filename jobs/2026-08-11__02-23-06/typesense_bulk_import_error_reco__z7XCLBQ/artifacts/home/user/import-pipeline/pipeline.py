import json
import re
import typesense

def load_dataset(filepath):
    documents = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                documents.append(json.loads(line))
    return documents

def apply_repairs(doc):
    # Create a deep-ish copy of the document
    repaired = dict(doc)
    
    # Rule 1: Currency-formatted price
    if 'price' in repaired and isinstance(repaired['price'], str):
        price_str = repaired['price']
        # Check if it is not directly numeric
        is_directly_numeric = False
        try:
            float(price_str)
            is_directly_numeric = True
        except ValueError:
            pass
            
        if not is_directly_numeric:
            # Normalize by removing currency symbols and thousands separators
            cleaned = price_str.replace('$', '').replace('€', '').replace('£', '').replace('¥', '').replace(',', '')
            try:
                repaired['price'] = float(cleaned)
            except ValueError:
                pass
                
    # Rule 2: Missing category
    if 'category' not in repaired:
        repaired['category'] = "uncategorized"
        
    return repaired

def is_valid_document(doc):
    # Check required fields
    required_fields = ['sku', 'name', 'price', 'quantity', 'category']
    for field in required_fields:
        if field not in doc or doc[field] is None:
            return False
            
    # Check types
    if not isinstance(doc['sku'], str):
        return False
    if not isinstance(doc['name'], str):
        return False
    if not isinstance(doc['category'], str):
        return False
        
    # Check price
    price = doc['price']
    if not isinstance(price, (int, float)):
        if isinstance(price, str):
            try:
                float(price)
            except ValueError:
                return False
        else:
            return False
            
    # Check quantity
    qty = doc['quantity']
    if not (isinstance(qty, int) and not isinstance(qty, bool)):
        if isinstance(qty, str):
            try:
                int(qty)
            except ValueError:
                return False
        else:
            return False
            
    return True

def main():
    raw_filepath = '/home/user/import-pipeline/data/raw_products.jsonl'
    report_filepath = '/home/user/import-pipeline/report.json'
    
    print("Loading raw products dataset...")
    raw_docs = load_dataset(raw_filepath)
    total_count = len(raw_docs)
    print(f"Loaded {total_count} documents from raw dataset.")
    
    # Initialize Typesense client
    print("Initializing Typesense client...")
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 10
    })
    
    # Recreate catalog collection with strict schema
    collection_name = 'catalog'
    print(f"Recreating collection '{collection_name}' with strict schema...")
    try:
        client.collections[collection_name].delete()
        print(f"Deleted existing collection '{collection_name}'.")
    except Exception:
        pass
        
    schema = {
        "name": collection_name,
        "fields": [
            {"name": "sku", "type": "string"},
            {"name": "name", "type": "string"},
            {"name": "price", "type": "float"},
            {"name": "quantity", "type": "int32"},
            {"name": "category", "type": "string"}
        ]
    }
    client.collections.create(schema)
    print(f"Created collection '{collection_name}' with strict schema.")
    
    # First Pass Bulk Import
    print("Importing raw products (First Pass)...")
    # Using action 'upsert' and dirty_values 'coerce_or_reject'
    import_params = {
        'action': 'upsert',
        'dirty_values': 'coerce_or_reject'
    }
    
    import_results = client.collections[collection_name].documents.import_(raw_docs, import_params)
    
    imported_first_pass = 0
    failed_first_pass_docs = []
    
    for idx, result in enumerate(import_results):
        source_doc = raw_docs[idx]
        success = result.get('success', False)
        if success:
            imported_first_pass += 1
        else:
            failed_first_pass_docs.append(source_doc)
            
    print(f"First Pass complete. Success: {imported_first_pass}, Failed: {len(failed_first_pass_docs)}")
    
    # Process failed documents for repair
    repaired_docs = []
    unfixable_ids = []
    
    for doc in failed_first_pass_docs:
        doc_id = doc.get('id')
        repaired = apply_repairs(doc)
        if is_valid_document(repaired):
            repaired_docs.append(repaired)
        else:
            unfixable_ids.append(doc_id)
            
    print(f"Repair analysis: {len(repaired_docs)} documents repaired, {len(unfixable_ids)} documents unfixable.")
    
    recovered_ids = []
    failed_ids = list(unfixable_ids)
    
    if repaired_docs:
        print("Importing repaired products (Second Pass)...")
        second_import_results = client.collections[collection_name].documents.import_(repaired_docs, import_params)
        
        for idx, result in enumerate(second_import_results):
            source_doc = repaired_docs[idx]
            doc_id = source_doc.get('id')
            success = result.get('success', False)
            if success:
                recovered_ids.append(doc_id)
            else:
                failed_ids.append(doc_id)
                
    # Sort IDs in ascending order as required
    recovered_ids.sort()
    failed_ids.sort()
    
    recovered_count = len(recovered_ids)
    failed_count = len(failed_ids)
    
    # Build report
    report = {
        "total": total_count,
        "imported_first_pass": imported_first_pass,
        "recovered": recovered_count,
        "failed": failed_count,
        "recovered_ids": recovered_ids,
        "failed_ids": failed_ids
    }
    
    # Print summary
    print("\n--- Pipeline Summary ---")
    print(f"Total Raw Documents:    {total_count}")
    print(f"Imported (First Pass):  {imported_first_pass}")
    print(f"Recovered (Repaired):   {recovered_count}")
    print(f"Failed (Unrepairable):  {failed_count}")
    print(f"Recovered IDs:          {recovered_ids}")
    print(f"Failed IDs:             {failed_ids}")
    
    # Consistency checks
    sum_counts = imported_first_pass + recovered_count + failed_count
    print(f"Consistency check (sum of counts == total): {sum_counts == total_count} ({sum_counts} == {total_count})")
    
    # Check count in Typesense
    collection_info = client.collections[collection_name].retrieve()
    actual_docs_in_typesense = collection_info.get('num_documents', 0)
    expected_docs_in_typesense = imported_first_pass + recovered_count
    print(f"Collection document count check: {actual_docs_in_typesense == expected_docs_in_typesense} (Actual: {actual_docs_in_typesense}, Expected: {expected_docs_in_typesense})")
    
    # Write report file
    print(f"Writing report to {report_filepath}...")
    with open(report_filepath, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print("Report written successfully.")

if __name__ == '__main__':
    main()
