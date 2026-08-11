const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read API Key and Run ID
let apiKey = '';
try {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (e) {
  console.error('Error reading API key:', e);
}

let runId = '';
try {
  runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
} catch (e) {
  console.error('Error reading run-id:', e);
}

console.log(`Loaded API Key: ${apiKey ? 'Found' : 'Missing'}`);
console.log(`Loaded Run ID: "${runId}"`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Schema Validation Helper
function validateSchema(collectionName, fields) {
  if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
    return 'Collection name cannot be empty.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
    return 'Collection name can only contain alphanumeric characters and underscores.';
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return 'At least one field must be defined.';
  }
  const seenNames = new Set();
  const allowedTypes = ['string', 'int', 'float', 'bool', 'string[]'];
  for (const field of fields) {
    if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
      return 'Field name cannot be empty.';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(field.name)) {
      return 'Field name can only contain alphanumeric characters and underscores.';
    }
    if (seenNames.has(field.name)) {
      return `Duplicate field name: "${field.name}".`;
    }
    seenNames.add(field.name);
    if (!allowedTypes.includes(field.type)) {
      return `Unsupported field type: "${field.type}".`;
    }
  }
  return null;
}

// 1. Create Collection
app.post('/api/collection', async (req, res) => {
  try {
    const { collectionName, fields } = req.body;

    // Validate schema
    const validationError = validateSchema(collectionName, fields);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const scopedName = `${collectionName}_${runId}`;

    // Map fields to Typesense format
    const mappedFields = fields.map(field => {
      return {
        name: field.name,
        type: field.type === 'int' ? 'int32' : field.type,
        facet: !!field.facet,
        optional: !!field.optional
      };
    });

    const schema = {
      name: scopedName,
      fields: mappedFields
    };

    console.log(`Creating collection ${scopedName} on Typesense...`);
    const response = await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Typesense creation error:', responseData);
      return res.status(response.status).json({
        success: false,
        error: responseData.message || 'Failed to create collection in Typesense'
      });
    }

    return res.status(201).json({ success: true, collection: responseData });
  } catch (error) {
    console.error('Server error creating collection:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Bulk Import
app.post('/api/import', async (req, res) => {
  try {
    const { collectionName, data } = req.body;

    if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
      return res.status(400).json({ success: false, error: 'Collection name is required.' });
    }
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ success: false, error: 'Import data is required.' });
    }

    const scopedName = `${collectionName}_${runId}`;

    console.log(`Importing documents into ${scopedName}...`);
    const response = await fetch(`http://127.0.0.1:8108/collections/${scopedName}/documents/import?dirty_values=coerce_or_reject`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'text/plain'
      },
      body: data
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Typesense import error:', responseText);
      let errMsg = 'Failed to import documents into Typesense';
      try {
        const errJson = JSON.parse(responseText);
        errMsg = errJson.message || errMsg;
      } catch (e) {}
      return res.status(response.status).json({ success: false, error: errMsg });
    }

    // Parse NDJSON response from Typesense to count success/rejections
    const lines = responseText.split('\n').filter(line => line.trim() !== '');
    let importedCount = 0;
    let rejectedCount = 0;

    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.success === true) {
          importedCount++;
        } else {
          rejectedCount++;
        }
      } catch (e) {
        // If a line in the response is not valid JSON, count as rejected
        rejectedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      importedCount,
      rejectedCount
    });
  } catch (error) {
    console.error('Server error importing documents:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Search
app.post('/api/search', async (req, res) => {
  try {
    const { collectionName, query } = req.body;

    if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
      return res.status(400).json({ success: false, error: 'Collection name is required.' });
    }

    const scopedName = `${collectionName}_${runId}`;

    // 1. Fetch collection schema to identify text fields for query_by
    const schemaResponse = await fetch(`http://127.0.0.1:8108/collections/${scopedName}`, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!schemaResponse.ok) {
      const errText = await schemaResponse.text();
      console.error('Failed to fetch schema:', errText);
      return res.status(schemaResponse.status).json({
        success: false,
        error: `Collection "${collectionName}" does not exist or schema fetch failed.`
      });
    }

    const schema = await schemaResponse.json();
    const textFields = schema.fields
      .filter(f => f.type === 'string' || f.type === 'string[]')
      .map(f => f.name);

    if (textFields.length === 0) {
      // If there are no text fields, we cannot search query_by, so return empty hits
      return res.status(200).json({ success: true, hits: [] });
    }

    const queryBy = textFields.join(',');
    const q = query && query.trim() !== '' ? query : '*';

    console.log(`Searching in ${scopedName} with q="${q}" query_by="${queryBy}"...`);
    const searchResponse = await fetch(`http://127.0.0.1:8108/collections/${scopedName}/documents/search?q=${encodeURIComponent(q)}&query_by=${encodeURIComponent(queryBy)}`, {
      method: 'GET',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('Typesense search error:', searchData);
      return res.status(searchResponse.status).json({
        success: false,
        error: searchData.message || 'Failed to execute search'
      });
    }

    // Return the hits
    const hits = searchData.hits || [];
    return res.status(200).json({ success: true, hits });
  } catch (error) {
    console.error('Server error searching documents:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening at http://127.0.0.1:${PORT}`);
});
