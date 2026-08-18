const fs = require('fs');
const readline = require('readline');
const Typesense = require('typesense');

const host = process.env.TYPESENSE_HOST || '127.0.0.1';
const port = process.env.TYPESENSE_PORT || '8108';
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
let apiKey = '';

if (fs.existsSync('/etc/typesense-api-key')) {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} else if (process.env.TYPESENSE_API_KEY) {
  apiKey = process.env.TYPESENSE_API_KEY;
}

const client = new Typesense.Client({
  nodes: [
    {
      host: host,
      port: parseInt(port),
      protocol: protocol
    }
  ],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

async function initialize() {
  console.log('Initializing Typesense collection...');
  
  // Define schema
  const schema = {
    name: 'products',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'brand', type: 'string', facet: true },
      { name: 'popularity', type: 'int32' },
      { name: 'price', type: 'float' }
    ],
    default_sorting_field: 'popularity'
  };

  // Delete collection if it exists
  try {
    await client.collections('products').delete();
    console.log('Deleted existing products collection.');
  } catch (err) {
    // Ignore if it doesn't exist
  }

  // Create collection
  await client.collections().create(schema);
  console.log('Created products collection.');

  // Load products.jsonl
  const products = [];
  const fileStream = fs.createReadStream('/home/user/app/data/products.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      products.push(JSON.parse(line));
    }
  }

  console.log(`Loaded ${products.length} products from JSONL. Indexing...`);
  
  // Index documents
  const importResults = await client.collections('products').documents().import(products, { action: 'create' });
  
  // Check for import errors
  const failedItems = importResults.filter(item => item.success === false);
  if (failedItems.length > 0) {
    console.error('Failed to import some items:', failedItems);
    throw new Error('Import failed');
  }

  console.log('Successfully indexed all products!');
}

if (require.main === module) {
  initialize().catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
  });
}

module.exports = { client, initialize };
