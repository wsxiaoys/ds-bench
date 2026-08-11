const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Read run-id and typesense api key
let runId = '';
try {
  runId = fs.readFileSync('/logs/artifacts/run-id', 'utf8').trim();
} catch (e) {
  console.error("Failed to read run-id:", e);
}

let apiKey = '';
try {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (e) {
  console.error("Failed to read api-key:", e);
}

// GET / -> Serves the single-page HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/collections -> Creates a collection
app.post('/api/collections', async (req, res) => {
  const { baseName, fields } = req.body;

  if (!baseName || typeof baseName !== 'string' || baseName.trim() === '') {
    return res.status(400).json({ success: false, error: "Collection name (base name) is required." });
  }

  const trimmedBase = baseName.trim();

  // Validate fields
  if (!Array.isArray(fields)) {
    return res.status(400).json({ success: false, error: "Fields must be an array." });
  }

  const seen = new Set();
  const mappedFields = [];

  for (const f of fields) {
    if (!f.name || typeof f.name !== 'string' || f.name.trim() === '') {
      return res.status(400).json({ success: false, error: "Each field must have a non-empty name." });
    }
    const name = f.name.trim();
    if (seen.has(name)) {
      return res.status(400).json({ success: false, error: `Duplicate field name: ${name}` });
    }
    seen.add(name);

    if (!['string', 'int', 'float', 'bool', 'string[]'].includes(f.type)) {
      return res.status(400).json({ success: false, error: `Unsupported field type: ${f.type}` });
    }

    // Map type: int -> int32, others keep same
    const typesenseType = f.type === 'int' ? 'int32' : f.type;

    mappedFields.push({
      name,
      type: typesenseType,
      facet: !!f.facet,
      optional: !!f.optional
    });
  }

  // Construct full collection name
  const fullCollectionName = `${trimmedBase}_${runId}`;

  // Call Typesense to create the collection
  try {
    // Delete existing collection with same name to ensure clean slate
    await fetch(`http://127.0.0.1:8108/collections/${fullCollectionName}`, {
      method: 'DELETE',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    // Create the collection
    const typesenseSchema = {
      name: fullCollectionName,
      fields: mappedFields
    };

    const response = await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(typesenseSchema)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errText;
      } catch (e) {}
      return res.status(400).json({ success: false, error: `Typesense error: ${errMsg}` });
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

// POST /api/import -> Imports dirty newline-delimited JSON
app.post('/api/import', async (req, res) => {
  const { collectionName, importData } = req.body;

  if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
    return res.status(400).json({ success: false, error: "Collection name is required." });
  }

  if (typeof importData !== 'string') {
    return res.status(400).json({ success: false, error: "Import data must be a string." });
  }

  const trimmedBase = collectionName.trim();
  const fullCollectionName = `${trimmedBase}_${runId}`;

  try {
    // Fetch schema from Typesense
    const schemaRes = await fetch(`http://127.0.0.1:8108/collections/${fullCollectionName}`, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!schemaRes.ok) {
      return res.status(404).json({ success: false, error: `Collection '${trimmedBase}' does not exist. Please create it first.` });
    }

    const schema = await schemaRes.json();
    const schemaFields = schema.fields || [];

    const lines = importData.split(/\r?\n/);
    let successfullyImported = 0;
    let rejectedRows = 0;
    const validDocs = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;

      let doc;
      try {
        doc = JSON.parse(trimmed);
      } catch (e) {
        rejectedRows++;
        continue;
      }

      if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        rejectedRows++;
        continue;
      }

      // Validate and convert against schema
      let isValid = true;
      const cleanedDoc = {};

      // Handle id field specifically if present
      if (doc.id !== undefined && doc.id !== null) {
        if (typeof doc.id === 'object') {
          isValid = false;
        } else {
          cleanedDoc.id = String(doc.id);
        }
      }

      if (!isValid) {
        rejectedRows++;
        continue;
      }

      for (const field of schemaFields) {
        const fieldName = field.name;
        const fieldType = field.type;
        const isOptional = field.optional;

        const val = doc[fieldName];

        if (val === undefined || val === null) {
          if (!isOptional) {
            isValid = false;
            break;
          }
          // If optional and missing, we omit it
        } else {
          const converted = convertField(val, fieldType);
          if (converted === null) {
            isValid = false;
            break;
          }
          cleanedDoc[fieldName] = converted;
        }
      }

      if (!isValid) {
        rejectedRows++;
        continue;
      }

      validDocs.push(cleanedDoc);
    }

    if (validDocs.length === 0) {
      return res.json({
        success: true,
        importedCount: 0,
        rejectedCount: rejectedRows
      });
    }

    // Import valid documents into Typesense
    const importBody = validDocs.map(d => JSON.stringify(d)).join('\n');
    const importRes = await fetch(`http://127.0.0.1:8108/collections/${fullCollectionName}/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'text/plain'
      },
      body: importBody
    });

    if (!importRes.ok) {
      const errText = await importRes.text();
      return res.status(500).json({ success: false, error: `Typesense import failed: ${errText}` });
    }

    const resText = await importRes.text();
    const resLines = resText.split(/\r?\n/);

    for (const line of resLines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;

      try {
        const resObj = JSON.parse(trimmed);
        if (resObj.success === true || resObj.success === undefined) {
          successfullyImported++;
        } else {
          rejectedRows++;
        }
      } catch (e) {
        rejectedRows++;
      }
    }

    return res.json({
      success: true,
      importedCount: successfullyImported,
      rejectedCount: rejectedRows
    });

  } catch (e) {
    return res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

// GET /api/search -> Full-text search
app.get('/api/search', async (req, res) => {
  const { collectionName, q } = req.query;

  if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
    return res.status(400).json({ success: false, error: "Collection name is required." });
  }

  const queryStr = q !== undefined ? String(q) : '';

  const trimmedBase = collectionName.trim();
  const fullCollectionName = `${trimmedBase}_${runId}`;

  try {
    // Fetch schema from Typesense to find text fields
    const schemaRes = await fetch(`http://127.0.0.1:8108/collections/${fullCollectionName}`, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!schemaRes.ok) {
      return res.status(404).json({ success: false, error: `Collection '${trimmedBase}' does not exist. Please create it first.` });
    }

    const schema = await schemaRes.json();
    const schemaFields = schema.fields || [];

    // Filter text fields (string or string[])
    const textFields = schemaFields
      .filter(f => f.type === 'string' || f.type === 'string[]')
      .map(f => f.name);

    if (textFields.length === 0) {
      return res.status(400).json({ success: false, error: "Collection has no text fields to search on." });
    }

    const queryBy = textFields.join(',');

    // Search against Typesense
    const searchUrl = `http://127.0.0.1:8108/collections/${fullCollectionName}/documents/search?q=${encodeURIComponent(queryStr)}&query_by=${encodeURIComponent(queryBy)}`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(500).json({ success: false, error: `Typesense search failed: ${errText}` });
    }

    const searchResult = await searchRes.json();
    return res.json({
      success: true,
      hits: searchResult.hits || []
    });

  } catch (e) {
    return res.status(500).json({ success: false, error: `Server error: ${e.message}` });
  }
});

function convertField(val, type) {
  if (type === 'string') {
    if (typeof val === 'object') return null;
    return String(val);
  }
  if (type === 'int32') {
    if (typeof val === 'object' || typeof val === 'boolean' || val === '') {
      return null;
    }
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num)) {
      return null;
    }
    return num;
  }
  if (type === 'float') {
    if (typeof val === 'object' || typeof val === 'boolean' || val === '') {
      return null;
    }
    const num = Number(val);
    if (isNaN(num)) {
      return null;
    }
    return num;
  }
  if (type === 'bool') {
    if (typeof val === 'boolean') {
      return val;
    }
    if (val === 'true' || val === '1' || val === 1) {
      return true;
    }
    if (val === 'false' || val === '0' || val === 0) {
      return false;
    }
    return null;
  }
  if (type === 'string[]') {
    if (Array.isArray(val)) {
      const arr = [];
      for (const item of val) {
        if (item === null || item === undefined || typeof item === 'object') {
          return null;
        }
        arr.push(String(item));
      }
      return arr;
    } else {
      if (typeof val === 'object') {
        return null;
      }
      return [String(val)];
    }
  }
  return null;
}

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
