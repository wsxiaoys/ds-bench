const fs = require('fs');

const TYPESENSE_URL = 'http://127.0.0.1:8108';
const API_KEY = 'lAE7Kftk3EdTiiIpeQNfRBHI1rDVaMQL';

async function main() {
  console.log('Reading documents...');
  const docsData = JSON.parse(fs.readFileSync('/home/user/kbsearch/data/documents.json', 'utf8'));

  const collectionName = 'knowledge_base';

  // 1. Delete collection if exists
  console.log(`Checking if collection ${collectionName} exists...`);
  try {
    const res = await fetch(`${TYPESENSE_URL}/collections/${collectionName}`, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (res.status === 200) {
      console.log('Collection exists. Deleting...');
      await fetch(`${TYPESENSE_URL}/collections/${collectionName}`, {
        method: 'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      console.log('Collection deleted.');
    }
  } catch (err) {
    console.error('Error checking/deleting collection:', err);
  }

  // 2. Create collection
  const schema = {
    name: collectionName,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'body', type: 'string' },
      { name: 'embedding', type: 'float[]', num_dim: 8 }
    ]
  };

  console.log('Creating collection...');
  const createRes = await fetch(`${TYPESENSE_URL}/collections`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(schema)
  });

  if (createRes.status !== 201) {
    const errText = await createRes.text();
    throw new Error(`Failed to create collection: ${createRes.status} ${errText}`);
  }
  console.log('Collection created successfully.');

  // 3. Index documents
  console.log('Indexing documents...');
  for (const doc of docsData) {
    const indexRes = await fetch(`${TYPESENSE_URL}/collections/${collectionName}/documents`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(doc)
    });

    if (indexRes.status !== 201) {
      const errText = await indexRes.text();
      console.error(`Failed to index document ${doc.id}:`, errText);
    } else {
      console.log(`Indexed document ${doc.id}`);
    }
  }

  console.log('All documents indexed successfully.');
}

main().catch(err => {
  console.error('Error in main:', err);
});
