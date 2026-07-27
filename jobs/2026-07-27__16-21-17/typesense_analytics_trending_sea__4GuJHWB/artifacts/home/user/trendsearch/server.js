'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const TS_HOST = process.env.TYPESENSE_HOST || '127.0.0.1';
const TS_PORT = process.env.TYPESENSE_PORT || '8108';
const TS_PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'http';
const TS_URL = `${TS_PROTOCOL}://${TS_HOST}:${TS_PORT}`;

function resolveApiKey() {
  if (process.env.TYPESENSE_API_KEY && process.env.TYPESENSE_API_KEY.trim()) {
    return process.env.TYPESENSE_API_KEY.trim();
  }
  const keyFile = '/etc/typesense-api-key';
  try {
    if (fs.existsSync(keyFile)) {
      const contents = fs.readFileSync(keyFile, 'utf8').trim();
      if (contents) return contents;
    }
  } catch (err) {
    // ignore, fall through to default
  }
  return 'xyz';
}

const TS_API_KEY = resolveApiKey();

const SEED_FILE = process.env.CATALOG_SEED_FILE || '/home/user/trendsearch/catalog-seed.json';
const CATALOG_COLLECTION = 'catalog';
const POPULAR_QUERIES_COLLECTION = 'product_queries';
const NO_HITS_QUERIES_COLLECTION = 'no_hits_queries';

const DATA_DIR = path.join(__dirname, 'data');
const TS_DATA_DIR = path.join(DATA_DIR, 'typesense-data');
const TS_ANALYTICS_DIR = path.join(DATA_DIR, 'typesense-analytics');

// ---------------------------------------------------------------------------
// Small helper for talking to the Typesense HTTP API
// ---------------------------------------------------------------------------

async function tsFetch(pathname, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${TS_URL}${pathname}`, {
    method,
    headers: {
      'X-TYPESENSE-API-KEY': TS_API_KEY,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function waitForTypesenseHealthy(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${TS_URL}/health`);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json && json.ok) return true;
      }
    } catch (err) {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Timed out waiting for Typesense to become healthy');
}

async function isTypesenseUp() {
  try {
    const res = await fetch(`${TS_URL}/health`);
    if (!res.ok) return false;
    const json = await res.json().catch(() => ({}));
    return !!(json && json.ok);
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Spawn an embedded Typesense server (if one isn't already running)
// ---------------------------------------------------------------------------

let tsProcess = null;

async function ensureTypesenseRunning() {
  if (await isTypesenseUp()) {
    console.log(`[typesense] already reachable at ${TS_URL}, reusing it`);
    return;
  }

  fs.mkdirSync(TS_DATA_DIR, { recursive: true });
  fs.mkdirSync(TS_ANALYTICS_DIR, { recursive: true });

  const args = [
    `--data-dir=${TS_DATA_DIR}`,
    `--api-key=${TS_API_KEY}`,
    `--api-address=0.0.0.0`,
    `--api-port=${TS_PORT}`,
    `--enable-search-analytics=true`,
    `--analytics-dir=${TS_ANALYTICS_DIR}`,
    `--analytics-flush-interval=60`,
  ];

  console.log('[typesense] starting embedded typesense-server:', args.join(' '));

  const logPath = path.join(DATA_DIR, 'typesense-server.log');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  tsProcess = spawn('typesense-server', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  tsProcess.stdout.pipe(logStream);
  tsProcess.stderr.pipe(logStream);
  tsProcess.on('exit', (code, signal) => {
    console.log(`[typesense] process exited (code=${code}, signal=${signal})`);
  });

  const cleanup = () => {
    if (tsProcess && !tsProcess.killed) {
      tsProcess.kill('SIGTERM');
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  await waitForTypesenseHealthy();
  console.log('[typesense] healthy');
}

// ---------------------------------------------------------------------------
// Collection / analytics rule bootstrap
// ---------------------------------------------------------------------------

async function ensureCollection(name, schema) {
  const existing = await tsFetch(`/collections/${encodeURIComponent(name)}`);
  if (existing.ok) return;
  const created = await tsFetch('/collections', { method: 'POST', body: schema });
  if (!created.ok && created.status !== 409) {
    const msg = (created.json && (created.json.message || JSON.stringify(created.json))) || 'unknown error';
    if (!/already exists/i.test(msg)) {
      throw new Error(`Failed to create collection ${name}: ${msg}`);
    }
  }
}

async function ensureAnalyticsRule(name, rule) {
  const existing = await tsFetch(`/analytics/rules/${encodeURIComponent(name)}`);
  if (existing.ok) return;
  const created = await tsFetch('/analytics/rules', { method: 'POST', body: { name, ...rule } });
  if (!created.ok) {
    const msg = (created.json && (created.json.message || JSON.stringify(created.json))) || 'unknown error';
    if (!/already exists/i.test(msg)) {
      throw new Error(`Failed to create analytics rule ${name}: ${msg}`);
    }
  }
}

async function importCatalog() {
  const raw = fs.readFileSync(SEED_FILE, 'utf8');
  const products = JSON.parse(raw);

  await ensureCollection(CATALOG_COLLECTION, {
    name: CATALOG_COLLECTION,
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'price', type: 'float' },
    ],
  });

  const jsonl = products.map((p) => JSON.stringify(p)).join('\n');
  const importRes = await fetch(
    `${TS_URL}/collections/${CATALOG_COLLECTION}/documents/import?action=upsert`,
    {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': TS_API_KEY,
        'Content-Type': 'text/plain',
      },
      body: jsonl,
    }
  );
  const text = await importRes.text();
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.success === false) {
        console.warn('[catalog import] failed row:', parsed);
      }
    } catch (e) {
      // ignore parse issues on individual lines
    }
  }
  console.log(`[catalog] imported ${products.length} products`);
  return products;
}

async function setupAnalytics() {
  await ensureCollection(POPULAR_QUERIES_COLLECTION, {
    name: POPULAR_QUERIES_COLLECTION,
    fields: [
      { name: 'q', type: 'string' },
      { name: 'count', type: 'int32' },
    ],
  });

  await ensureCollection(NO_HITS_QUERIES_COLLECTION, {
    name: NO_HITS_QUERIES_COLLECTION,
    fields: [
      { name: 'q', type: 'string' },
      { name: 'count', type: 'int32' },
    ],
  });

  await ensureAnalyticsRule('product_queries_rule', {
    type: 'popular_queries',
    params: {
      source: { collections: [CATALOG_COLLECTION] },
      destination: { collection: POPULAR_QUERIES_COLLECTION },
      limit: 1000,
    },
  });

  await ensureAnalyticsRule('no_hits_queries_rule', {
    type: 'nohits_queries',
    params: {
      source: { collections: [CATALOG_COLLECTION] },
      destination: { collection: NO_HITS_QUERIES_COLLECTION },
      limit: 1000,
    },
  });

  console.log('[analytics] rules configured');
}

// ---------------------------------------------------------------------------
// Search / trending helpers used by the API
// ---------------------------------------------------------------------------

let fallbackSuggestions = ['laptop', 'camera', 'phone', 'drone', 'tablet'];

function computeFallbackSuggestions(products) {
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
  if (categories.length) {
    fallbackSuggestions = categories.map((c) => c.toLowerCase());
  }
}

async function runCatalogSearch(q) {
  const effectiveQ = q && q.trim().length ? q : '*';
  const userId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    q: effectiveQ,
    query_by: 'name',
    per_page: '50',
  });
  const res = await fetch(`${TS_URL}/collections/${CATALOG_COLLECTION}/documents/search?${params.toString()}`, {
    headers: {
      'X-TYPESENSE-API-KEY': TS_API_KEY,
      'X-TYPESENSE-USER-ID': userId,
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Typesense search failed (${res.status}): ${errText}`);
  }
  const json = await res.json();
  return json;
}

async function fetchTrending() {
  try {
    const params = new URLSearchParams({
      q: '*',
      query_by: 'q',
      per_page: '250',
    });
    const res = await fetch(
      `${TS_URL}/collections/${POPULAR_QUERIES_COLLECTION}/documents/search?${params.toString()}`,
      { headers: { 'X-TYPESENSE-API-KEY': TS_API_KEY } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const hits = json.hits || [];
    const items = hits
      .map((h) => h.document)
      .filter((d) => d && typeof d.q === 'string' && typeof d.count === 'number' && d.count > 0)
      .map((d) => ({ q: d.q, count: d.count }));
    items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.q < b.q ? -1 : a.q > b.q ? 1 : 0;
    });
    return items;
  } catch (err) {
    return [];
  }
}

async function getSuggestions(currentQuery) {
  const trending = await fetchTrending();
  const lowerCurrent = (currentQuery || '').toLowerCase();
  let suggestions = trending
    .map((t) => t.q)
    .filter((q) => q.toLowerCase() !== lowerCurrent)
    .slice(0, 5);

  if (suggestions.length === 0) {
    suggestions = fallbackSuggestions.slice(0, 5);
  }
  if (suggestions.length === 0) {
    suggestions = ['laptop'];
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    const result = await runCatalogSearch(q);
    const found = typeof result.found === 'number' ? result.found : 0;
    const hits = (result.hits || []).map((h) => {
      const doc = h.document || {};
      return {
        id: doc.id,
        name: doc.name,
        category: doc.category,
        price: doc.price,
      };
    });
    const suggestions = found === 0 ? await getSuggestions(q) : [];
    res.json({ query: q, found, hits, suggestions });
  } catch (err) {
    console.error('[api/search] error:', err);
    res.json({ query: q, found: 0, hits: [], suggestions: await getSuggestions(q) });
  }
});

app.get('/api/trending', async (req, res) => {
  const trending = await fetchTrending();
  res.json({ trending });
});

app.get('/api/health', async (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

async function main() {
  await ensureTypesenseRunning();
  const products = await importCatalog();
  computeFallbackSuggestions(products);
  await setupAnalytics();

  app.listen(PORT, () => {
    console.log(`[server] listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
