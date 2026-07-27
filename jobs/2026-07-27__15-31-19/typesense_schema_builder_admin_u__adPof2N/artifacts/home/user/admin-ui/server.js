const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Read run-id and api-key on startup
let runId = '';
let apiKey = '';

try {
  runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
} catch (e) {
  console.error('Error reading run-id:', e);
}

try {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (e) {
  console.error('Error reading api-key:', e);
}

// Serve the single page app at GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create collection
app.post('/api/collection', async (req, res) => {
  try {
    const { name, fields } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Collection name is required.' });
    }

    const baseName = name.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(baseName)) {
      return res.status(400).json({ error: 'Collection name contains invalid characters.' });
    }

    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'At least one field is required.' });
    }

    const fieldNames = new Set();
    const validTypes = new Set(['string', 'int', 'float', 'bool', 'string[]']);

    for (const f of fields) {
      if (!f.name || typeof f.name !== 'string' || f.name.trim() === '') {
        return res.status(400).json({ error: 'Field name is required.' });
      }
      const fName = f.name.trim();
      if (!/^[a-zA-Z0-9_]+$/.test(fName)) {
        return res.status(400).json({ error: `Field name "${fName}" contains invalid characters.` });
      }
      if (fieldNames.has(fName)) {
        return res.status(400).json({ error: `Duplicate field name: "${fName}".` });
      }
      fieldNames.add(fName);

      if (!validTypes.has(f.type)) {
        return res.status(400).json({ error: `Invalid field type for "${fName}": "${f.type}".` });
      }
    }

    // 2. Format collection name
    const collectionName = `${baseName}_${runId}`;

    // 3. Delete existing collection if it exists
    try {
      await fetch(`http://127.0.0.1:8108/collections/${collectionName}`, {
        method: 'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': apiKey }
      });
    } catch (e) {
      // Ignore if not exist
    }

    // 4. Map and create
    const typesenseFields = fields.map(f => ({
      name: f.name.trim(),
      type: f.type === 'int' ? 'int32' : f.type,
      facet: !!f.facet,
      optional: !!f.optional
    }));

    const payload = {
      name: collectionName,
      fields: typesenseFields
    };

    const createRes = await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(400).json({ error: `Typesense error: ${errText}` });
    }

    const createdCollection = await createRes.json();
    return res.json({ success: true, collection: createdCollection });

  } catch (error) {
    console.error('Error in /api/collection:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Import documents
app.post('/api/import', async (req, res) => {
  try {
    const { name, data } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Collection name is required.' });
    }

    if (typeof data !== 'string') {
      return res.status(400).json({ error: 'Import data must be a string.' });
    }

    const baseName = name.trim();
    const collectionName = `${baseName}_${runId}`;

    // Fetch schema from Typesense
    const schemaRes = await fetch(`http://127.0.0.1:8108/collections/${collectionName}`, {
      method: 'GET',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!schemaRes.ok) {
      return res.status(404).json({ error: `Collection "${collectionName}" does not exist.` });
    }

    const schema = await schemaRes.json();
    const schemaFields = {};
    for (const f of schema.fields) {
      schemaFields[f.name] = f;
    }

    const lines = data.split('\n');
    let successCount = 0;
    let rejectedCount = 0;
    const docsToImport = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {
        continue;
      }

      let doc;
      try {
        doc = JSON.parse(line);
      } catch (e) {
        rejectedCount++;
        continue;
      }

      let isValid = true;
      const convertedDoc = {};

      // Preserve id if present and valid
      if (doc.hasOwnProperty('id') && doc.id !== null && doc.id !== undefined) {
        convertedDoc.id = String(doc.id);
      }

      for (const fName in schemaFields) {
        const field = schemaFields[fName];
        const fType = field.type;
        const fOptional = field.optional;

        if (!doc.hasOwnProperty(fName) || doc[fName] === null || doc[fName] === undefined) {
          if (fOptional) {
            continue;
          } else {
            isValid = false;
            break;
          }
        }

        const val = doc[fName];

        if (fType === 'string') {
          if (typeof val === 'string') {
            convertedDoc[fName] = val;
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            convertedDoc[fName] = String(val);
          } else {
            isValid = false;
            break;
          }
        } else if (fType === 'int32') {
          if (typeof val === 'number') {
            if (Number.isNaN(val) || !Number.isFinite(val)) {
              isValid = false;
              break;
            }
            convertedDoc[fName] = Math.trunc(val);
          } else if (typeof val === 'string') {
            const trimmed = val.trim();
            const num = Number(trimmed);
            if (trimmed === '' || Number.isNaN(num) || !Number.isFinite(num)) {
              isValid = false;
              break;
            }
            convertedDoc[fName] = Math.trunc(num);
          } else {
            isValid = false;
            break;
          }
        } else if (fType === 'float') {
          if (typeof val === 'number') {
            if (Number.isNaN(val) || !Number.isFinite(val)) {
              isValid = false;
              break;
            }
            convertedDoc[fName] = val;
          } else if (typeof val === 'string') {
            const trimmed = val.trim();
            const num = Number(trimmed);
            if (trimmed === '' || Number.isNaN(num) || !Number.isFinite(num)) {
              isValid = false;
              break;
            }
            convertedDoc[fName] = num;
          } else {
            isValid = false;
            break;
          }
        } else if (fType === 'bool') {
          if (typeof val === 'boolean') {
            convertedDoc[fName] = val;
          } else if (typeof val === 'string') {
            const trimmed = val.trim().toLowerCase();
            if (trimmed === 'true' || trimmed === '1') {
              convertedDoc[fName] = true;
            } else if (trimmed === 'false' || trimmed === '0') {
              convertedDoc[fName] = false;
            } else {
              isValid = false;
              break;
            }
          } else if (typeof val === 'number') {
            if (val === 1) {
              convertedDoc[fName] = true;
            } else if (val === 0) {
              convertedDoc[fName] = false;
            } else {
              isValid = false;
              break;
            }
          } else {
            isValid = false;
            break;
          }
        } else if (fType === 'string[]') {
          if (Array.isArray(val)) {
            convertedDoc[fName] = val.map(item => String(item));
          } else if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  convertedDoc[fName] = parsed.map(item => String(item));
                } else {
                  convertedDoc[fName] = [trimmed];
                }
              } catch (e) {
                convertedDoc[fName] = [trimmed];
              }
            } else {
              convertedDoc[fName] = [trimmed];
            }
          } else if (typeof val === 'number' || typeof val === 'boolean') {
            convertedDoc[fName] = [String(val)];
          } else {
            isValid = false;
            break;
          }
        } else {
          isValid = false;
          break;
        }
      }

      if (!isValid) {
        rejectedCount++;
        continue;
      }

      docsToImport.push(convertedDoc);
    }

    if (docsToImport.length > 0) {
      const importBody = docsToImport.map(d => JSON.stringify(d)).join('\n');
      const importRes = await fetch(`http://127.0.0.1:8108/collections/${collectionName}/documents/import?action=create`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': apiKey,
          'Content-Type': 'text/plain'
        },
        body: importBody
      });

      const resText = await importRes.text();
      const resLines = resText.split('\n').filter(l => l.trim() !== '');
      for (const line of resLines) {
        try {
          const resObj = JSON.parse(line);
          if (resObj.success === true) {
            successCount++;
          } else {
            rejectedCount++;
          }
        } catch (e) {
          rejectedCount++;
        }
      }
    }

    return res.json({
      success: true,
      importedCount: successCount,
      rejectedCount: rejectedCount
    });

  } catch (error) {
    console.error('Error in /api/import:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Search documents
app.post('/api/search', async (req, res) => {
  try {
    const { name, q } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Collection name is required.' });
    }

    const baseName = name.trim();
    const collectionName = `${baseName}_${runId}`;
    const queryStr = typeof q === 'string' ? q : '';

    // Fetch schema to find searchable fields
    const schemaRes = await fetch(`http://127.0.0.1:8108/collections/${collectionName}`, {
      method: 'GET',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!schemaRes.ok) {
      return res.status(404).json({ error: `Collection "${collectionName}" does not exist.` });
    }

    const schema = await schemaRes.json();
    const textFields = schema.fields
      .filter(f => f.type === 'string' || f.type === 'string[]')
      .map(f => f.name);

    if (textFields.length === 0) {
      return res.json({ hits: [] });
    }

    const queryBy = textFields.join(',');
    const searchUrl = `http://127.0.0.1:8108/collections/${collectionName}/documents/search?q=${encodeURIComponent(queryStr)}&query_by=${encodeURIComponent(queryBy)}`;

    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(400).json({ error: `Typesense error: ${errText}` });
    }

    const searchData = await searchRes.json();
    const hits = (searchData.hits || []).map(h => h.document);
    return res.json({ hits });

  } catch (error) {
    console.error('Error in /api/search:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
