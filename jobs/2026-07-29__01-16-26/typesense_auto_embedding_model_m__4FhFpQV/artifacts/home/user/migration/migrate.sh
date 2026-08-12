#!/bin/bash
# Typesense Vector Field Migration Script
# Migrates the `content_embedding` field in the `notes` collection from 4-dim to 8-dim in-place.

set -e

TYPESENSE_URL="http://localhost:8108"
API_KEY="xyz"
NEW_VECTORS_FILE="/home/user/migration/new_vectors.jsonl"

echo "=== Starting Typesense Vector Field Migration ==="

# 1. Drop the existing content_embedding field from the schema
echo "1. Dropping existing content_embedding field from schema..."
curl -s -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
     -X PATCH \
     -H "Content-Type: application/json" \
     -d '{"fields": [{"name": "content_embedding", "drop": true}]}' \
     "${TYPESENSE_URL}/collections/notes"
echo -e "\nField dropped successfully."

# 2. Update the documents with the new 8-dimensional vectors
echo "2. Importing/updating documents with new 8-dimensional vectors..."
curl -s -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
     -X POST \
     -H "Content-Type: text/plain" \
     --data-binary "@${NEW_VECTORS_FILE}" \
     "${TYPESENSE_URL}/collections/notes/documents/import?action=update"
echo -e "\nDocuments updated successfully."

# 3. Add the content_embedding field back to the schema with num_dim=8
echo "3. Adding content_embedding field back to schema with num_dim=8..."
curl -s -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
     -X PATCH \
     -H "Content-Type: application/json" \
     -d '{"fields": [{"name": "content_embedding", "type": "float[]", "num_dim": 8, "vec_dist": "cosine", "hnsw_params": {"M": 16, "ef_construction": 200}}]}' \
     "${TYPESENSE_URL}/collections/notes"
echo -e "\nField added back with 8 dimensions successfully."

# 4. Verify the schema
echo "4. Verifying new collection schema..."
curl -s -H "X-TYPESENSE-API-KEY: ${API_KEY}" "${TYPESENSE_URL}/collections/notes" | jq .
echo -e "\nSchema verification complete."

# 5. Verify vector search
echo "5. Testing nearest-neighbor vector search..."
curl -s -g -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
     "${TYPESENSE_URL}/collections/notes/documents/search?q=*&vector_query=content_embedding:%28[0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18],k:3%29" | jq .hits[0]
echo -e "\nMigration completed successfully!"
