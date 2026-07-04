KEY="$ALCHEMYST_AI_API_KEY"
curl -s -X POST 'https://platform-backend.getalchemystai.com/api/v1/context/search?metadata=true' \
  -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"query":"engineering product API release version notes","similarity_threshold":0.1,"minimum_similarity_threshold":0.1,"scope":"internal","metadata":{"groupName":["eng","v1"]}}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); ctxs=d.get("contexts",[]); print("count=",len(ctxs)); [print("  - ",(c.get("content") or "")[:120]) for c in ctxs]'
