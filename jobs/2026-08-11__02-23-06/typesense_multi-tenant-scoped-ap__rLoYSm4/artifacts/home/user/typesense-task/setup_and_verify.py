import json
import typesense
import sys

def main():
    # 1. Initialize Typesense client with admin bootstrap key
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    collection_name = 'records'

    # 2. Delete existing collection if it exists
    try:
        client.collections[collection_name].delete()
        print(f"Deleted existing '{collection_name}' collection.")
    except Exception:
        pass

    # 3. Create the collection schema
    schema = {
        'name': collection_name,
        'fields': [
            {'name': 'tenant_id', 'type': 'string', 'facet': True},
            {'name': 'title', 'type': 'string'},
            {'name': 'category', 'type': 'string'},
            {'name': 'secret_notes', 'type': 'string'}
        ]
    }
    client.collections.create(schema)
    print(f"Created collection '{collection_name}'.")

    # 4. Load and index documents
    documents = []
    tenants = set()
    with open('/home/user/typesense-task/data/documents.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                doc = json.loads(line)
                documents.append(doc)
                tenants.add(doc['tenant_id'])

    print(f"Loaded {len(documents)} documents. Found distinct tenants: {list(tenants)}")

    # Bulk import
    import_results = client.collections[collection_name].documents.import_(documents)
    print("Bulk import completed.")
    
    # 5. Create parent search-only API key
    parent_key_schema = {
        'description': 'Parent search-only key for records',
        'actions': ['documents:search'],
        'collections': [collection_name]
    }
    parent_key_res = client.keys.create(parent_key_schema)
    parent_search_key = parent_key_res['value']
    print(f"Created parent search-only key: {parent_search_key}")

    # 6. Generate Scoped Search API Keys for each tenant
    scoped_keys = {}
    for tenant_id in sorted(tenants):
        parameters = {
            'filter_by': f'tenant_id:={tenant_id}',
            'exclude_fields': 'secret_notes'
        }
        scoped_key_bytes = client.keys.generate_scoped_search_key(parent_search_key, parameters)
        scoped_key = scoped_key_bytes.decode('utf-8')
        scoped_keys[tenant_id] = scoped_key
        print(f"Generated scoped search key for tenant '{tenant_id}': {scoped_key}")

    # 7. Verification phase
    print("\n--- Running Verification Phase ---")
    for tenant_id, scoped_key in scoped_keys.items():
        print(f"\nVerifying tenant: {tenant_id}")
        
        # Create a client using the scoped key
        tenant_client = typesense.Client({
            'nodes': [{
                'host': 'localhost',
                'port': '8108',
                'protocol': 'http'
            }],
            'api_key': scoped_key,
            'connection_timeout_seconds': 5
        })

        # Test 1: Simple search for all documents accessible to this tenant
        try:
            res = tenant_client.collections[collection_name].documents.search({
                'q': '*',
                'query_by': 'title'
            })
            hits = res.get('hits', [])
            print(f"  Standard search returned {len(hits)} hits.")
            
            # Verify that only this tenant's documents are returned
            for hit in hits:
                doc = hit['document']
                doc_tenant = doc.get('tenant_id')
                if doc_tenant != tenant_id:
                    print(f"  [ERROR] Found document from tenant '{doc_tenant}' when searching as '{tenant_id}'!")
                    sys.exit(1)
                if 'secret_notes' in doc:
                    print(f"  [ERROR] 'secret_notes' field was NOT excluded for tenant '{tenant_id}'!")
                    sys.exit(1)
            
            print(f"  [SUCCESS] Only tenant '{tenant_id}' documents returned and 'secret_notes' was excluded.")
        except Exception as e:
            print(f"  [ERROR] Search failed with scoped key: {e}")
            sys.exit(1)

        # Test 2: Attempt to bypass multi-tenant isolation by requesting another tenant's data explicitly
        other_tenant = [t for t in tenants if t != tenant_id][0]
        try:
            bypass_res = tenant_client.collections[collection_name].documents.search({
                'q': '*',
                'query_by': 'title',
                'filter_by': f'tenant_id:={other_tenant}'
            })
            bypass_hits = bypass_res.get('hits', [])
            print(f"  Attempt to bypass by filtering for '{other_tenant}' returned {len(bypass_hits)} hits.")
            
            # Verify that no documents from other_tenant are returned
            for hit in bypass_hits:
                doc = hit['document']
                doc_tenant = doc.get('tenant_id')
                if doc_tenant == other_tenant:
                    print(f"  [ERROR] Security Bypass! Accessed '{other_tenant}' data while logged in as '{tenant_id}'!")
                    sys.exit(1)
            
            print(f"  [SUCCESS] Client-side filter override failed to expose other tenant's data.")
        except Exception as e:
            # If Typesense rejects the query, that's also a valid security boundary, but usually it just returns 0 results
            # because the filter clauses are logically AND-ed, resulting in `tenant_id:=tenant_id AND tenant_id:=other_tenant` which is unsatisfiable.
            print(f"  [INFO] Bypass attempt search resulted in exception (this is secure): {e}")

    print("\nAll verifications passed successfully!")

    # 8. Write the artifact file
    output_data = {
        'collection': collection_name,
        'parent_search_key': parent_search_key,
        'scoped_keys': scoped_keys
    }
    
    artifact_path = '/home/user/typesense-task/scoped_keys.json'
    with open(artifact_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"\nArtifact written to {artifact_path}")

if __name__ == '__main__':
    main()
