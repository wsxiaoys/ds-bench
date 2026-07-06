KEY="$ALCHEMYST_AI_API_KEY"
echo '---TEST 1: body.metadata.groupName ---'
curl -s -X POST 'https://platform-backend.getalchemystai.com/api/v1/context/search?metadata=true' \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"engineering notes","similarity_threshold":0.1,"minimum_similarity_threshold":0.1,"scope":"internal","metadata":{"groupName":["eng","v1"]}}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); ctxs=d.get("contexts",[]); print("count=",len(ctxs))'
echo '---TEST 2: body.metadata.groupName AND (body group_name snake) ---'
curl -s -X POST 'https://platform-backend.getalchemystai.com/api/v1/context/search' \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"engineering notes","similarity_threshold":0.1,"minimum_similarity_threshold":0.1,"scope":"internal","metadata":{"group_name":["eng","v1"]}}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); ctxs=d.get("contexts",[]); print("count=",len(ctxs))'
echo '---TEST 3: body.metadata.groupName with metadata=true query ---'
curl -s -X POST 'https://platform-backend.getalchemystai.com/api/v1/context/search?metadata=true' \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"engineering notes","similarity_threshold":0.1,"minimum_similarity_threshold":0.1,"scope":"external","metadata":{"groupName":["eng","v1"]}}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); ctxs=d.get("contexts",[]); print("count=",len(ctxs)); [print(c.get("content","")[:60]) for c in ctxs[:5]]'
