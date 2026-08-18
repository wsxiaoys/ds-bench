const fs = require('fs');

const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = 'gy1KoExUd4ysKMaHBOkCVGdd627hI4d5';

async function init() {
  try {
    // 1. Check if products collection exists
    console.log('Checking products collection...');
    let exists = false;
    try {
      const res = await fetch(`${TYPESENSE_HOST}/collections/products`, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      if (res.status === 200) {
        exists = true;
        console.log('Collection already exists.');
      } else {
        console.log('Collection status:', res.status);
      }
    } catch (e) {
      console.log('Collection does not exist or error:', e.message);
    }

    // 2. If not, create it
    if (!exists) {
      console.log('Creating products collection...');
      const schema = {
        name: 'products',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'category', type: 'string', facet: true },
          { name: 'price', type: 'float' }
        ]
      };
      const res = await fetch(`${TYPESENSE_HOST}/collections`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(schema)
      });
      const data = await res.json();
      console.log('Create collection response:', res.status, data);
    }

    // 3. Import baseline documents
    console.log('Importing baseline documents...');
    const baseline = JSON.parse(fs.readFileSync('data/baseline.json', 'utf8'));
    
    // In Typesense, import takes JSONL (newline-separated JSON objects)
    const jsonl = baseline.map(doc => JSON.stringify(doc)).join('\n');
    
    const importRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });
    
    const importText = await importRes.text();
    console.log('Import baseline response:', importRes.status, importText);

    // 4. Test search
    console.log('Testing search with empty query...');
    const searchRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/search?q=*&query_by=name`, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    const searchData = await searchRes.json();
    console.log('Search response:', searchRes.status, JSON.stringify(searchData, null, 2));

  } catch (error) {
    console.error('Error in init:', error);
  }
}

init();
