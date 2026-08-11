const fs = require('fs');
const path = require('path');

const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = 'XiKwGzOimJpb7rQhnIYHPTGjm6X9xhpO';

async function init() {
  const collectionName = 'products';
  
  // 1. Delete collection if exists
  console.log('Checking if collection exists...');
  try {
    const res = await fetch(`${TYPESENSE_HOST}/collections/${collectionName}`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (res.ok) {
      console.log('Deleted existing collection.');
    }
  } catch (e) {
    console.log('Collection delete error (might not exist):', e.message);
  }

  // 2. Create collection
  const schema = {
    name: collectionName,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'price', type: 'float' },
      { name: 'rating', type: 'float' },
      { name: 'tags', type: 'string[]', facet: true }
    ]
  };

  console.log('Creating collection...');
  const createRes = await fetch(`${TYPESENSE_HOST}/collections`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(schema)
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('Failed to create collection:', errText);
    process.exit(1);
  }
  console.log('Collection created successfully.');

  // 3. Read and index documents
  const dataPath = path.join(__dirname, 'data', 'products.jsonl');
  const fileContent = fs.readFileSync(dataPath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  console.log(`Found ${lines.length} documents to index.`);
  
  // We can index them using Typesense import API (which accepts JSONL)
  const importRes = await fetch(`${TYPESENSE_HOST}/collections/${collectionName}/documents/import?action=create`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'text/plain'
    },
    body: lines.join('\n')
  });

  const importText = await importRes.text();
  console.log('Import response:', importText);
}

init().catch(console.error);
