'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;
const HOST = '127.0.0.1';
const TS_URL = 'http://127.0.0.1:8108';

function readTrimmed(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/[\r\n]+$/g, '').trim();
}

const API_KEY = readTrimmed('/etc/typesense-api-key');
const RUN_ID = readTrimmed('/logs/artifacts/run-id');

const ALLOWED_TYPES = ['string', 'int', 'float', 'bool', 'string[]'];

function mapFormTypeToTypesense(t) {
  if (t === 'int') return 'int32';
  return t; // string, float, bool, string[] map 1:1
}

function mapTypesenseTypeToForm(t) {
  if (t === 'int32') return 'int';
  return t;
}

// In-memory registry of collections created through this admin session.
// Keyed by baseName -> { tsName, fields: [{name, type(form), facet, optional}] }
const registry = new Map();

async function tsFetch(pathname, options) {
  const opts = Object.assign({}, options);
  opts.headers = Object.assign(
    { 'X-TYPESENSE-API-KEY': API_KEY },
    options && options.headers ? options.headers : {}
  );
  const res = await fetch(`${TS_URL}${pathname}`, opts);
  return res;
}

async function fetchCollectionInfo(baseName) {
  if (registry.has(baseName)) return registry.get(baseName);
  const tsName = `${baseName}_${RUN_ID}`;
  const res = await tsFetch(`/collections/${encodeURIComponent(tsName)}`, { method: 'GET' });
  if (!res.ok) return null;
  const body = await res.json();
  const fields = (body.fields || [])
    .filter((f) => f.name !== 'id')
    .map((f) => ({
      name: f.name,
      type: mapTypesenseTypeToForm(f.type),
      facet: !!f.facet,
      optional: !!f.optional,
    }));
  const info = { tsName, fields };
  registry.set(baseName, info);
  return info;
}

function validateSchema(baseName, fields) {
  if (!baseName || typeof baseName !== 'string' || !baseName.trim()) {
    return 'Collection name is required.';
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return 'At least one field is required.';
  }
  const seen = new Set();
  for (const f of fields) {
    if (!f || typeof f.name !== 'string' || !f.name.trim()) {
      return 'Every field must have a non-empty name.';
    }
    if (seen.has(f.name)) {
      return `Duplicate field name: "${f.name}".`;
    }
    seen.add(f.name);
    if (!ALLOWED_TYPES.includes(f.type)) {
      return `Unsupported field type: "${f.type}".`;
    }
  }
  return null;
}

// --- Value coercion for dirty-data import ---------------------------------

function coerceString(value) {
  if (typeof value === 'string') return { ok: true, value };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { ok: true, value: String(value) };
  }
  return { ok: false };
}

function coerceInt32(value) {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { ok: true, value };
    return { ok: false };
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^-?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (Number.isSafeInteger(n)) return { ok: true, value: n };
    }
    return { ok: false };
  }
  return { ok: false };
}

function coerceFloat(value) {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return { ok: true, value };
    return { ok: false };
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) {
      const n = parseFloat(s);
      if (Number.isFinite(n)) return { ok: true, value: n };
    }
    return { ok: false };
  }
  return { ok: false };
}

function coerceBool(value) {
  if (typeof value === 'boolean') return { ok: true, value };
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'true') return { ok: true, value: true };
    if (s === 'false') return { ok: true, value: false };
    return { ok: false };
  }
  if (typeof value === 'number') {
    if (value === 1) return { ok: true, value: true };
    if (value === 0) return { ok: true, value: false };
    return { ok: false };
  }
  return { ok: false };
}

function coerceStringArray(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      const r = coerceString(item);
      if (!r.ok) return { ok: false };
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
  if (typeof value === 'string') {
    return { ok: true, value: [value] };
  }
  return { ok: false };
}

function coerceByType(tsType, value) {
  switch (tsType) {
    case 'string':
      return coerceString(value);
    case 'int32':
      return coerceInt32(value);
    case 'float':
      return coerceFloat(value);
    case 'bool':
      return coerceBool(value);
    case 'string[]':
      return coerceStringArray(value);
    default:
      return { ok: false };
  }
}

// Validate + coerce one parsed JSON document against a Typesense field schema.
// Returns { ok:true, doc } or { ok:false, reason }
function processDocument(rawDoc, tsFields) {
  if (!rawDoc || typeof rawDoc !== 'object' || Array.isArray(rawDoc)) {
    return { ok: false, reason: 'not a JSON object' };
  }
  const out = {};
  if (Object.prototype.hasOwnProperty.call(rawDoc, 'id')) {
    const idVal = rawDoc.id;
    out.id = typeof idVal === 'string' ? idVal : String(idVal);
  }
  for (const f of tsFields) {
    const present = Object.prototype.hasOwnProperty.call(rawDoc, f.name) && rawDoc[f.name] !== null;
    if (!present) {
      if (f.optional) continue;
      return { ok: false, reason: `missing required field "${f.name}"` };
    }
    const coerced = coerceByType(f.type, rawDoc[f.name]);
    if (!coerced.ok) {
      return { ok: false, reason: `field "${f.name}" cannot be converted to ${f.type}` };
    }
    out[f.name] = coerced.value;
  }
  return { ok: true, doc: out };
}

// --- HTTP plumbing ----------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');

async function handleCreateCollection(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid JSON payload.' });
  }
  const baseName = payload.baseName;
  const fields = payload.fields;

  const validationError = validateSchema(baseName, fields);
  if (validationError) {
    return sendJson(res, 400, { error: validationError });
  }

  const tsName = `${baseName}_${RUN_ID}`;
  const tsFields = fields.map((f) => ({
    name: f.name,
    type: mapFormTypeToTypesense(f.type),
    facet: !!f.facet,
    optional: !!f.optional,
  }));

  let tsRes;
  try {
    tsRes = await tsFetch('/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tsName, fields: tsFields }),
    });
  } catch (e) {
    return sendJson(res, 502, { error: `Could not reach Typesense: ${e.message}` });
  }

  const body = await tsRes.json().catch(() => ({}));
  if (!tsRes.ok) {
    return sendJson(res, 400, { error: body.message || `Typesense error (HTTP ${tsRes.status})` });
  }

  registry.set(baseName, {
    tsName,
    fields: fields.map((f) => ({
      name: f.name,
      type: f.type,
      facet: !!f.facet,
      optional: !!f.optional,
    })),
  });

  return sendJson(res, 200, { ok: true, collection: tsName });
}

async function handleImport(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid JSON payload.' });
  }
  const baseName = payload.baseName;
  const data = payload.data || '';

  if (!baseName || typeof baseName !== 'string' || !baseName.trim()) {
    return sendJson(res, 400, { error: 'Collection name is required.' });
  }

  const info = await fetchCollectionInfo(baseName);
  if (!info) {
    return sendJson(res, 400, { error: 'Collection has not been created yet.' });
  }

  const tsFields = info.fields.map((f) => ({
    name: f.name,
    type: mapFormTypeToTypesense(f.type),
    facet: f.facet,
    optional: f.optional,
  }));

  const lines = data.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  let selfRejected = 0;
  const toImport = [];

  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      selfRejected += 1;
      continue;
    }
    const result = processDocument(parsed, tsFields);
    if (!result.ok) {
      selfRejected += 1;
      continue;
    }
    toImport.push(result.doc);
  }

  let imported = 0;
  let tsRejected = 0;

  if (toImport.length > 0) {
    const ndjson = toImport.map((d) => JSON.stringify(d)).join('\n');
    let importRes;
    try {
      importRes = await tsFetch(
        `/collections/${encodeURIComponent(info.tsName)}/documents/import?action=create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: ndjson,
        }
      );
    } catch (e) {
      return sendJson(res, 502, { error: `Could not reach Typesense: ${e.message}` });
    }
    const text = await importRes.text();
    const resultLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    for (const rl of resultLines) {
      try {
        const parsedResult = JSON.parse(rl);
        if (parsedResult.success) {
          imported += 1;
        } else {
          tsRejected += 1;
        }
      } catch (e) {
        tsRejected += 1;
      }
    }
  }

  const rejected = selfRejected + tsRejected;
  return sendJson(res, 200, { imported, rejected });
}

async function handleSearch(req, res, url) {
  const baseName = url.searchParams.get('baseName') || '';
  const q = url.searchParams.get('q') || '*';

  if (!baseName.trim()) {
    return sendJson(res, 400, { error: 'Collection name is required.' });
  }

  const info = await fetchCollectionInfo(baseName);
  if (!info) {
    return sendJson(res, 400, { error: 'Collection has not been created yet.' });
  }

  const textFields = info.fields.filter((f) => f.type === 'string' || f.type === 'string[]').map((f) => f.name);
  const queryBy = textFields.length > 0 ? textFields.join(',') : info.fields.map((f) => f.name).join(',');

  const searchUrl =
    `/collections/${encodeURIComponent(info.tsName)}/documents/search` +
    `?q=${encodeURIComponent(q || '*')}&query_by=${encodeURIComponent(queryBy)}&per_page=50`;

  let tsRes;
  try {
    tsRes = await tsFetch(searchUrl, { method: 'GET' });
  } catch (e) {
    return sendJson(res, 502, { error: `Could not reach Typesense: ${e.message}` });
  }
  const body = await tsRes.json().catch(() => ({}));
  if (!tsRes.ok) {
    return sendJson(res, 400, { error: body.message || `Typesense error (HTTP ${tsRes.status})` });
  }
  const hits = (body.hits || []).map((h) => h.document);
  return sendJson(res, 200, { hits });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/schema') {
      return await handleCreateCollection(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/import') {
      return await handleImport(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/search') {
      return await handleSearch(req, res, url);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    sendJson(res, 500, { error: `Internal error: ${err.message}` });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Admin UI listening on http://${HOST}:${PORT} (run-id=${RUN_ID})`);
});
