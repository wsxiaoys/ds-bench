#!/usr/bin/env bash
# Typesense Vector Field Migration Script
# Migrates the "notes" collection in-place from 4-dimensional to 8-dimensional embeddings.

set -euo pipefail

TYPESENSE_HOST="http://localhost:8108"
API_KEY="xyz"
VECTORS_FILE="/home/user/migration/new_vectors.jsonl"

echo "=== Starting Typesense Vector Migration ==="

# 1. Drop the existing content_embedding field from the schema
echo "Step 1: Dropping 'content_embedding' field from schema..."
curl -s -X PATCH "${TYPESENSE_HOST}/collections/notes" \
  -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [
      {"name": "content_embedding", "drop": true}
    ]
  }' | jq .

# 2. Update the existing documents on disk with the new 8-dimensional vectors
echo "Step 2: Importing new 8-dimensional vectors..."
curl -s -X POST "${TYPESENSE_HOST}/collections/notes/documents/import?action=update" \
  -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
  -H "Content-Type: text/plain" \
  --data-binary "@${VECTORS_FILE}"

# 3. Add the content_embedding field back to the schema with num_dim: 8
echo "Step 3: Re-adding 'content_embedding' to schema with 8 dimensions..."
curl -s -X PATCH "${TYPESENSE_HOST}/collections/notes" \
  -H "X-TYPESENSE-API-KEY: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [
      {
        "name": "content_embedding",
        "type": "float[]",
        "num_dim": 8,
        "index": true,
        "vec_dist": "cosine",
        "hnsw_params": {
          "M": 16,
          "ef_construction": 200
        }
      }
    ]
  }' | jq .

# 4. Verify vector search works
echo "Step 4: Verifying nearest-neighbor vector search..."
curl -s "${TYPESENSE_HOST}/collections/notes/documents/search?q=*&vector_query=content_embedding:(\[0.1,0.1,0.1,0.1,0.1,0.1,0.1,0.1\],k:3)" \
  -H "X-TYPESENSE-API-KEY: ${API_KEY}" | jq .found

echo "=== Migration Completed Successfully ==="
