const fs = require('fs');

const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = 'BpXn5H4kecGZCkdccUltHtVkIC4ZwYcM';

async function run() {
  console.log("Starting test-index.js...");

  // 1. Delete collection if exists
  try {
    const delRes = await fetch(`${TYPESENSE_HOST}/collections/products`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    console.log("Delete products collection status:", delRes.status);
  } catch (e) {
    console.log("Products collection did not exist or delete failed:", e.message);
  }

  // 2. Create collection
  const schema = {
    name: 'products',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'price', type: 'float', facet: true },
      { name: 'rating', type: 'float', facet: true },
      { name: 'tags', type: 'string[]', facet: true }
    ]
  };

  const createRes = await fetch(`${TYPESENSE_HOST}/collections`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(schema)
  });
  console.log("Create products collection status:", createRes.status);
  if (createRes.status !== 201) {
    const text = await createRes.text();
    console.error("Create collection failed:", text);
    return;
  }

  // 3. Import documents
  const data = fs.readFileSync('/home/user/filterchip/data/products.jsonl', 'utf8');
  const importRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'text/plain'
    },
    body: data
  });
  console.log("Import documents status:", importRes.status);
  const importText = await importRes.text();
  console.log("Import response:", importText);

  // 4. Run a simple search
  const searchRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/search?q=*&filter_by=brand:=\`Smith, Jones & Co.\``, {
    headers: { 'X-TYPESENSE-API-KEY': API_KEY }
  });
  console.log("Search status:", searchRes.status);
  const searchJson = await searchRes.json();
  console.log("Search results count:", searchJson.found);
  console.log("Search result hits:", searchJson.hits.map(h => h.document));
}

run().catch(console.error);
