const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get Typesense API key and Run ID dynamically
function getTypesenseConfig() {
  let apiKey = '';
  try {
    apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
  } catch (err) {
    console.error('Error reading /etc/typesense-api-key:', err);
  }

  let runId = '';
  try {
    runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
  } catch (err) {
    console.error('Error reading /logs/artifacts/run-id:', err);
  }

  return { apiKey, runId };
}

// 1. CREATE COLLECTION ENDPOINT
app.post('/api/collections', async (req, res) => {
  const { name, fields } = req.body;
  const { apiKey, runId } = getTypesenseConfig();

  // Backend Validation
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Collection name is required and must be a string.' });
  }

  const baseName = name.trim();
  if (!/^[a-zA-Z0-9_]+$/.test(baseName)) {
    return res.status(400).json({ success: false, error: 'Collection name must contain only alphanumeric characters and underscores.' });
  }

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ success: false, error: 'Fields list is required and cannot be empty.' });
  }

  // Validate fields
  const seenNames = new Set();
  const supportedTypes = ['string', 'int', 'float', 'bool', 'string[]'];

  for (const field of fields) {
    if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Field name is required for all fields.' });
    }
    
    const fieldName = field.name.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(fieldName)) {
      return res.status(400).json({ success: false, error: `Field name "${fieldName}" must contain only alphanumeric characters and underscores.` });
    }

    if (seenNames.has(fieldName.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Schema contains duplicate field name: "${fieldName}".` });
    }
    seenNames.add(fieldName.toLowerCase());

    if (!supportedTypes.includes(field.type)) {
      return res.status(400).json({ success: false, error: `Field "${fieldName}" has unsupported type: "${field.type}".` });
    }
  }

  const actualCollectionName = `${baseName}_${runId}`;

  try {
    // Delete existing collection first to ensure a clean slate
    await fetch(`http://127.0.0.1:8108/collections/${actualCollectionName}`, {
      method: 'DELETE',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    // Map fields to Typesense format
    const mappedFields = fields.map(f => ({
      name: f.name.trim(),
      type: f.type === 'int' ? 'int32' : f.type,
      facet: !!f.facet,
      optional: !!f.optional
    }));

    // Create collection in Typesense
    const createResponse = await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TYPESENSE-API-KEY': apiKey
      },
      body: JSON.stringify({
        name: actualCollectionName,
        fields: mappedFields
      })
    });

    const createResult = await createResponse.json();

    if (!createResponse.ok) {
      throw new Error(createResult.message || 'Failed to create collection in Typesense');
    }

    return res.json({ success: true, collection: actualCollectionName });

  } catch (err) {
    console.error('Create Collection Error:', err);
    
    // Ensure no collection exists for this name on failure
    try {
      await fetch(`http://127.0.0.1:8108/collections/${actualCollectionName}`, {
        method: 'DELETE',
        headers: {
          'X-TYPESENSE-API-KEY': apiKey
        }
      });
    } catch (delErr) {
      console.error('Cleanup Delete Error:', delErr);
    }

    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. BULK IMPORT ENDPOINT
app.post('/api/import', async (req, res) => {
  const { collectionName, importData } = req.body;
  const { apiKey, runId } = getTypesenseConfig();

  if (!collectionName || typeof collectionName !== 'string') {
    return res.status(400).json({ success: false, error: 'Collection name is required.' });
  }

  if (!importData || typeof importData !== 'string') {
    return res.status(400).json({ success: false, error: 'Import data is required.' });
  }

  const actualCollectionName = `${collectionName.trim()}_${runId}`;

  try {
    // 1. Fetch collection schema from Typesense
    const schemaResponse = await fetch(`http://127.0.0.1:8108/collections/${actualCollectionName}`, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!schemaResponse.ok) {
      const errRes = await schemaResponse.json();
      return res.status(400).json({ success: false, error: `Collection does not exist or error fetching schema: ${errRes.message || schemaResponse.statusText}` });
    }

    const schema = await schemaResponse.json();
    const fieldsMap = {};
    schema.fields.forEach(f => {
      fieldsMap[f.name] = f;
    });

    // 2. Parse and validate/coerce each line
    const lines = importData.split('\n');
    let successCount = 0;
    let rejectCount = 0;
    const validDocs = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      let doc;
      try {
        doc = JSON.parse(line);
      } catch (e) {
        rejectCount++;
        continue;
      }

      let isDocValid = true;

      // Validate/Coerce against schema fields
      for (const fieldName of Object.keys(fieldsMap)) {
        const fieldSchema = fieldsMap[fieldName];
        const val = doc[fieldName];

        if (val === undefined || val === null) {
          if (!fieldSchema.optional) {
            // Required field is missing
            isDocValid = false;
            break;
          } else {
            // Optional and missing, remove nulls to avoid Typesense validation issues
            delete doc[fieldName];
          }
        } else {
          // Field is present, check and coerce type
          const expectedType = fieldSchema.type;

          if (expectedType === 'string') {
            if (typeof val !== 'string') {
              if (typeof val === 'number' || typeof val === 'boolean') {
                doc[fieldName] = String(val);
              } else {
                isDocValid = false;
                break;
              }
            }
          } else if (expectedType === 'int32') {
            if (typeof val === 'number') {
              if (Number.isInteger(val)) {
                doc[fieldName] = val;
              } else {
                isDocValid = false;
                break;
              }
            } else if (typeof val === 'string') {
              const trimmed = val.trim();
              if (/^-?\d+$/.test(trimmed)) {
                doc[fieldName] = parseInt(trimmed, 10);
              } else {
                isDocValid = false;
                break;
              }
            } else {
              isDocValid = false;
              break;
            }
          } else if (expectedType === 'float') {
            if (typeof val === 'number') {
              doc[fieldName] = val;
            } else if (typeof val === 'string') {
              const trimmed = val.trim();
              const num = Number(trimmed);
              if (!isNaN(num) && isFinite(num) && trimmed !== '') {
                doc[fieldName] = num;
              } else {
                isDocValid = false;
                break;
              }
            } else {
              isDocValid = false;
              break;
            }
          } else if (expectedType === 'bool') {
            if (typeof val === 'boolean') {
              doc[fieldName] = val;
            } else if (typeof val === 'string') {
              const trimmed = val.trim().toLowerCase();
              if (trimmed === 'true' || trimmed === '1') {
                doc[fieldName] = true;
              } else if (trimmed === 'false' || trimmed === '0') {
                doc[fieldName] = false;
              } else {
                isDocValid = false;
                break;
              }
            } else if (typeof val === 'number') {
              if (val === 1) {
                doc[fieldName] = true;
              } else if (val === 0) {
                doc[fieldName] = false;
              } else {
                isDocValid = false;
                break;
              }
            } else {
              isDocValid = false;
              break;
            }
          } else if (expectedType === 'string[]') {
            if (Array.isArray(val)) {
              doc[fieldName] = val.map(v => String(v));
            } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
              doc[fieldName] = [String(val)];
            } else {
              isDocValid = false;
              break;
            }
          }
        }
      }

      if (isDocValid) {
        // Ensure id is a string if present
        if (doc.id !== undefined && doc.id !== null) {
          doc.id = String(doc.id);
        }
        validDocs.push(doc);
      } else {
        rejectCount++;
      }
    }

    // 3. Send valid docs to Typesense
    if (validDocs.length > 0) {
      const importPayload = validDocs.map(d => JSON.stringify(d)).join('\n');
      
      const importResponse = await fetch(`http://127.0.0.1:8108/collections/${actualCollectionName}/documents/import?action=create&dirty_values=coerce_or_reject`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': apiKey,
          'Content-Type': 'text/plain'
        },
        body: importPayload
      });

      const importResultText = await importResponse.text();
      const resultLines = importResultText.split('\n');

      for (const resLine of resultLines) {
        const trimmedResLine = resLine.trim();
        if (trimmedResLine === '') continue;

        try {
          const resObj = JSON.parse(trimmedResLine);
          if (resObj.success === true) {
            successCount++;
          } else {
            rejectCount++;
          }
        } catch (e) {
          rejectCount++;
        }
      }
    }

    return res.json({
      success: true,
      imported: successCount,
      rejected: rejectCount
    });

  } catch (err) {
    console.error('Import Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. SEARCH ENDPOINT
app.get('/api/search', async (req, res) => {
  const { collectionName, q } = req.query;
  const { apiKey, runId } = getTypesenseConfig();

  if (!collectionName || typeof collectionName !== 'string') {
    return res.status(400).json({ success: false, error: 'Collection name is required.' });
  }

  const actualCollectionName = `${collectionName.trim()}_${runId}`;
  const queryStr = q ? String(q).trim() : '';

  try {
    // Fetch schema to find searchable fields
    const schemaResponse = await fetch(`http://127.0.0.1:8108/collections/${actualCollectionName}`, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!schemaResponse.ok) {
      const errRes = await schemaResponse.json();
      return res.status(400).json({ success: false, error: `Collection does not exist or error fetching schema: ${errRes.message || schemaResponse.statusText}` });
    }

    const schema = await schemaResponse.json();
    
    // Find string/string[] fields for query_by
    const stringFields = schema.fields
      .filter(f => f.type === 'string' || f.type === 'string[]')
      .map(f => f.name);

    if (stringFields.length === 0) {
      return res.json({ success: true, results: [] });
    }

    const queryBy = stringFields.join(',');

    // Perform Typesense search
    const searchUrl = `http://127.0.0.1:8108/collections/${actualCollectionName}/documents/search?q=${encodeURIComponent(queryStr || '*')}&query_by=${encodeURIComponent(queryBy)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    const searchResult = await searchResponse.json();

    if (!searchResponse.ok) {
      throw new Error(searchResult.message || 'Failed to search in Typesense');
    }

    const results = (searchResult.hits || []).map(h => h.document);

    return res.json({ success: true, results });

  } catch (err) {
    console.error('Search Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend on all other GET routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Web server listening on http://127.0.0.1:${PORT}`);
});
