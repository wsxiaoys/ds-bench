import json
import typesense

def setup_and_verify():
    # 1. Discover the set of tenants from the dataset
    data_file_path = "/home/user/typesense-task/data/documents.jsonl"
    documents = []
    tenants = set()
    
    with open(data_file_path, "r") as f:
        for line in f:
            if line.strip():
                doc = json.loads(line)
                documents.append(doc)
                if "tenant_id" in doc:
                    tenants.add(doc["tenant_id"])
                    
    print(f"Discovered tenants: {tenants}")
    print(f"Loaded {len(documents)} documents.")

    # 2. Initialize Typesense client with bootstrap key 'xyz'
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # 3. Recreate the 'records' collection
    collection_name = "records"
    try:
        client.collections[collection_name].delete()
        print(f"Deleted existing collection: {collection_name}")
    except Exception as e:
        print(f"Collection {collection_name} does not exist yet or could not be deleted: {e}")

    schema = {
        'name': collection_name,
        'fields': [
            {'name': 'tenant_id', 'type': 'string', 'facet': True},
            {'name': 'title', 'type': 'string'},
            {'name': 'category', 'type': 'string', 'facet': True, 'optional': True},
            {'name': 'secret_notes', 'type': 'string', 'optional': True}
        ]
    }
    
    client.collections.create(schema)
    print(f"Created collection: {collection_name}")

    # 4. Index documents
    import_results = client.collections[collection_name].documents.import_(documents)
    print(f"Imported documents. Results: {import_results}")

    # 5. Create a parent search-only API key
    parent_key_schema = {
        'description': 'Parent search-only key for records',
        'actions': ['documents:search'],
        'collections': [collection_name]
    }
    parent_key_response = client.keys.create(parent_key_schema)
    parent_search_key = parent_key_response['value']
    print(f"Created parent search-only key: {parent_search_key}")

    # 6. Generate Scoped Search API Key for each tenant
    scoped_keys = {}
    for tenant_id in sorted(tenants):
        parameters = {
            'filter_by': f'tenant_id:={tenant_id}',
            'exclude_fields': 'secret_notes'
        }
        # generate_scoped_search_key returns bytes, decode to string
        scoped_key = client.keys.generate_scoped_search_key(parent_search_key, parameters).decode('utf-8')
        scoped_keys[tenant_id] = scoped_key
        print(f"Generated scoped search key for '{tenant_id}': {scoped_key}")

    # 7. Verification
    print("\n--- Running Verification ---")
    for tenant_id in sorted(tenants):
        print(f"\nVerifying tenant: {tenant_id}")
        tenant_key = scoped_keys[tenant_id]
        
        # Create a client using the scoped key
        tenant_client = typesense.Client({
            'nodes': [{
                'host': 'localhost',
                'port': '8108',
                'protocol': 'http'
            }],
            'api_key': tenant_key,
            'connection_timeout_seconds': 5
        })
        
        # A. General search: should only return this tenant's documents
        search_params = {
            'q': '*',
            'query_by': 'title'
        }
        res = tenant_client.collections[collection_name].documents.search(search_params)
        hits = res.get('hits', [])
        print(f"General search found {len(hits)} documents.")
        
        for hit in hits:
            doc = hit['document']
            doc_tenant = doc.get('tenant_id')
            print(f"  Found doc ID: {doc.get('id')}, tenant_id: {doc_tenant}")
            
            # Assert only own documents are returned
            assert doc_tenant == tenant_id, f"ERROR: Scoped key for {tenant_id} returned document for {doc_tenant}!"
            # Assert secret_notes is excluded
            assert 'secret_notes' not in doc, f"ERROR: Scoped key for {tenant_id} returned secret_notes field!"

        # B. Malicious search: try to filter for another tenant
        other_tenant = [t for t in tenants if t != tenant_id][0]
        malicious_params = {
            'q': '*',
            'query_by': 'title',
            'filter_by': f'tenant_id:={other_tenant}'
        }
        malicious_res = tenant_client.collections[collection_name].documents.search(malicious_params)
        malicious_hits = malicious_res.get('hits', [])
        print(f"Malicious search (filtering for '{other_tenant}') found {len(malicious_hits)} documents.")
        
        for hit in malicious_hits:
            doc = hit['document']
            doc_tenant = doc.get('tenant_id')
            assert doc_tenant == tenant_id, f"ERROR: Scoped key for {tenant_id} bypassed filter and returned document for {doc_tenant}!"
            
        assert len(malicious_hits) == 0, f"ERROR: Expected 0 hits when tenant '{tenant_id}' tried to filter for '{other_tenant}', but got {len(malicious_hits)} hits!"
        
    print("\nVerification passed successfully!")

    # 8. Write the results to /home/user/typesense-task/scoped_keys.json
    output_data = {
        "collection": collection_name,
        "parent_search_key": parent_search_key,
        "scoped_keys": scoped_keys
    }
    
    output_file_path = "/home/user/typesense-task/scoped_keys.json"
    with open(output_file_path, "w") as out_f:
        json.dump(output_data, out_f, indent=2)
        
    print(f"Wrote keys and collection info to {output_file_path}")

if __name__ == "__main__":
    setup_and_verify()
