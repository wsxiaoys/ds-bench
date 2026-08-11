import json
import typesense

def main():
    # Initialize Typesense client
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # 1. Delete collection if it already exists
    try:
        client.collections['records'].delete()
        print("Deleted existing 'records' collection.")
    except Exception as e:
        print("No existing 'records' collection found or error deleting:", e)

    # 2. Create 'records' collection
    schema = {
        'name': 'records',
        'fields': [
            {'name': 'tenant_id', 'type': 'string', 'facet': True},
            {'name': 'title', 'type': 'string'},
            {'name': 'category', 'type': 'string', 'facet': True, 'optional': True},
            {'name': 'secret_notes', 'type': 'string', 'optional': True}
        ]
    }
    client.collections.create(schema)
    print("Created 'records' collection.")

    # 3. Read dataset and get distinct tenants
    documents = []
    tenants = set()
    with open('/home/user/typesense-task/data/documents.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                doc = json.loads(line)
                documents.append(doc)
                if 'tenant_id' in doc:
                    tenants.add(doc['tenant_id'])

    print(f"Loaded {len(documents)} documents. Found tenants: {tenants}")

    # 4. Index documents
    import_results = client.collections['records'].documents.import_(documents)
    print("Indexed documents. Results sample:", import_results[:2])

    # 5. Create a parent search-only API key
    # The actions must be limited to 'documents:search' and collections to 'records'
    parent_key_schema = {
        'description': 'Parent search-only key for multi-tenant scoped keys',
        'actions': ['documents:search'],
        'collections': ['records']
    }
    parent_key_data = client.keys.create(parent_key_schema)
    parent_search_key = parent_key_data['value']
    print(f"Created parent search-only API key: {parent_search_key}")

    # 6. Generate Scoped Search API Key for each distinct tenant
    scoped_keys = {}
    for tenant_id in sorted(tenants):
        parameters = {
            'filter_by': f'tenant_id:{tenant_id}',
            'exclude_fields': 'secret_notes'
        }
        # Generate the scoped search key (which is returned as a bytes object)
        scoped_key_bytes = client.keys.generate_scoped_search_key(parent_search_key, parameters)
        scoped_key_str = scoped_key_bytes.decode('utf-8')
        scoped_keys[tenant_id] = scoped_key_str
        print(f"Generated scoped key for tenant '{tenant_id}': {scoped_key_str}")

    # 7. Write results to artifact file
    artifact = {
        'collection': 'records',
        'parent_search_key': parent_search_key,
        'scoped_keys': scoped_keys
    }
    with open('/home/user/typesense-task/scoped_keys.json', 'w') as f:
        json.dump(artifact, f, indent=2)
    print("Wrote results to /home/user/typesense-task/scoped_keys.json")

    # 8. Verification
    print("\n--- Verifying Scoped Search Keys ---")
    for tenant_id, scoped_key in scoped_keys.items():
        print(f"\nVerifying tenant: {tenant_id}")
        tenant_client = typesense.Client({
            'nodes': [{
                'host': 'localhost',
                'port': '8108',
                'protocol': 'http'
            }],
            'api_key': scoped_key,
            'connection_timeout_seconds': 5
        })

        # Try a search for everything in the records collection
        try:
            search_params = {
                'q': '*',
                'query_by': 'title'
            }
            results = tenant_client.collections['records'].documents.search(search_params)
            hits = results.get('hits', [])
            print(f"Total hits found: {len(hits)}")

            # Assertions
            for hit in hits:
                doc = hit['document']
                doc_id = doc.get('id')
                doc_tenant = doc.get('tenant_id')
                doc_title = doc.get('title')
                
                print(f"  - Hit: ID={doc_id}, tenant_id={doc_tenant}, title='{doc_title}'")
                
                # Check 1: Must only return documents belonging to this tenant
                assert doc_tenant == tenant_id, f"CRITICAL: Scoped key for '{tenant_id}' returned document for tenant '{doc_tenant}'!"
                
                # Check 2: Must exclude secret_notes
                assert 'secret_notes' not in doc, f"CRITICAL: Scoped key for '{tenant_id}' returned 'secret_notes'!"

            # Check 3: Try to bypass the tenant restriction by searching with a filter_by for another tenant
            # E.g., if we are tenant 'acme', we try to search with filter_by: 'tenant_id:globex'.
            # Typesense should AND the embedded filter with this filter, resulting in 0 hits.
            other_tenant = 'globex' if tenant_id != 'globex' else 'acme'
            bypass_params = {
                'q': '*',
                'query_by': 'title',
                'filter_by': f'tenant_id:{other_tenant}'
            }
            bypass_results = tenant_client.collections['records'].documents.search(bypass_params)
            bypass_hits = bypass_results.get('hits', [])
            print(f"Bypass attempt with filter_by='tenant_id:{other_tenant}' returned {len(bypass_hits)} hits.")
            assert len(bypass_hits) == 0, f"CRITICAL: Bypass attempt succeeded! Returned {len(bypass_hits)} hits."

            print(f"Tenant '{tenant_id}' verification PASSED!")

        except Exception as e:
            print(f"Verification failed for tenant '{tenant_id}': {e}")
            raise e

    print("\nAll verifications PASSED successfully!")

if __name__ == '__main__':
    main()
