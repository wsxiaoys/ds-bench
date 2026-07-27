"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || "127.0.0.1";
const TYPESENSE_PORT = process.env.TYPESENSE_PORT || "8108";
const TYPESENSE_URL = `http://${TYPESENSE_HOST}:${TYPESENSE_PORT}`;
const TYPESENSE_API_KEY_FILE = process.env.TYPESENSE_API_KEY_FILE || "/etc/typesense-api-key";
const TYPESENSE_API_KEY = fs.readFileSync(TYPESENSE_API_KEY_FILE, "utf8").trim();

const COLLECTION_NAME = "knowledge_base";

const APP_HOST = "127.0.0.1";
const APP_PORT = 8080;

const documents = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "documents.json"), "utf8"));
const queryVectors = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "query_vectors.json"), "utf8"));

const docTitleById = new Map(documents.map((d) => [d.id, d.title]));

function tsHeaders(extra) {
  return Object.assign(
    {
      "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
      "Content-Type": "application/json",
    },
    extra || {}
  );
}

async function waitForTypesense(maxAttempts = 60, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${TYPESENSE_URL}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.ok === true) return true;
      }
    } catch (e) {
      // ignore, retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Typesense server did not become healthy in time");
}

async function collectionExists() {
  const res = await fetch(`${TYPESENSE_URL}/collections/${COLLECTION_NAME}`, {
    headers: tsHeaders(),
  });
  return res.status === 200;
}

async function createCollection() {
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: "title", type: "string" },
      { name: "body", type: "string" },
      { name: "embedding", type: "float[]", num_dim: 8 },
    ],
  };
  const res = await fetch(`${TYPESENSE_URL}/collections`, {
    method: "POST",
    headers: tsHeaders(),
    body: JSON.stringify(schema),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create collection: ${res.status} ${text}`);
  }
}

async function importDocuments() {
  const jsonl = documents.map((d) => JSON.stringify(d)).join("\n");
  const res = await fetch(
    `${TYPESENSE_URL}/collections/${COLLECTION_NAME}/documents/import?action=upsert`,
    {
      method: "POST",
      headers: tsHeaders({ "Content-Type": "text/plain" }),
      body: jsonl,
    }
  );
  const text = await res.text();
  const lines = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const failed = lines.filter((l) => l.success !== true);
  if (failed.length > 0) {
    throw new Error(`Failed to import documents: ${JSON.stringify(failed)}`);
  }
}

async function setupTypesense() {
  await waitForTypesense();
  const exists = await collectionExists();
  if (!exists) {
    await createCollection();
  }
  await importDocuments();
  console.log(`Indexed ${documents.length} documents into '${COLLECTION_NAME}' collection.`);
}

// ---- Search helpers -------------------------------------------------------

async function typesenseKeywordSearch(queryText) {
  const params = new URLSearchParams({
    q: queryText && queryText.length > 0 ? queryText : "*",
    query_by: "title,body",
    per_page: String(documents.length),
  });
  const res = await fetch(
    `${TYPESENSE_URL}/collections/${COLLECTION_NAME}/documents/search?${params.toString()}`,
    { headers: tsHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keyword search failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  const scores = new Map();
  for (const doc of documents) scores.set(doc.id, 0);
  for (const hit of body.hits || []) {
    scores.set(hit.document.id, Number(hit.text_match || 0));
  }
  return scores;
}

async function typesenseVectorSearch(vector) {
  const vectorQuery = `embedding:([${vector.join(",")}], k:${documents.length})`;
  const params = new URLSearchParams({
    q: "*",
    vector_query: vectorQuery,
    per_page: String(documents.length),
  });
  const res = await fetch(
    `${TYPESENSE_URL}/collections/${COLLECTION_NAME}/documents/search?${params.toString()}`,
    { headers: tsHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vector search failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  const distances = new Map();
  for (const doc of documents) distances.set(doc.id, 2); // max cosine distance fallback
  for (const hit of body.hits || []) {
    distances.set(hit.document.id, Number(hit.vector_distance));
  }
  // Convert distance to similarity: higher is better.
  const similarities = new Map();
  for (const [id, dist] of distances.entries()) {
    similarities.set(id, 1 - dist);
  }
  return similarities;
}

function normalizeScores(scoreMap) {
  const values = Array.from(scoreMap.values());
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min;
  const normalized = new Map();
  for (const [id, v] of scoreMap.entries()) {
    if (range <= 0) {
      normalized.set(id, 0);
    } else {
      normalized.set(id, (v - min) / range);
    }
  }
  return normalized;
}

function getQueryVector(queryText) {
  if (Object.prototype.hasOwnProperty.call(queryVectors, queryText)) {
    return queryVectors[queryText];
  }
  return new Array(8).fill(0);
}

function buildResults(scoreMap) {
  const results = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    score: scoreMap.get(doc.id) || 0,
  }));
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id); // deterministic tie-break
  });
  // Round scores for readability while keeping deterministic ordering above.
  return results.map((r) => ({ ...r, score: Math.round(r.score * 1e6) / 1e6 }));
}

async function performSearch(queryText, mode, alpha) {
  if (mode === "keyword") {
    const rawKeyword = await typesenseKeywordSearch(queryText);
    const normKeyword = normalizeScores(rawKeyword);
    return buildResults(normKeyword);
  }

  if (mode === "semantic") {
    const vector = getQueryVector(queryText);
    const rawSemantic = await typesenseVectorSearch(vector);
    const normSemantic = normalizeScores(rawSemantic);
    return buildResults(normSemantic);
  }

  if (mode === "hybrid") {
    const vector = getQueryVector(queryText);
    const [rawKeyword, rawSemantic] = await Promise.all([
      typesenseKeywordSearch(queryText),
      typesenseVectorSearch(vector),
    ]);
    const normKeyword = normalizeScores(rawKeyword);
    const normSemantic = normalizeScores(rawSemantic);
    const hybrid = new Map();
    for (const doc of documents) {
      const k = normKeyword.get(doc.id) || 0;
      const s = normSemantic.get(doc.id) || 0;
      hybrid.set(doc.id, alpha * s + (1 - alpha) * k);
    }
    return buildResults(hybrid);
  }

  throw new Error(`Unknown mode: ${mode}`);
}

// ---- HTTP server ----------------------------------------------------------

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (req.method === "GET" && pathname === "/") {
    serveStaticFile(res, path.join(PUBLIC_DIR, "index.html"));
    return;
  }

  if (req.method === "GET" && pathname === "/api/search") {
    const q = parsedUrl.searchParams.get("q") || "";
    let mode = (parsedUrl.searchParams.get("mode") || "keyword").toLowerCase();
    let alpha = parseFloat(parsedUrl.searchParams.get("alpha"));
    if (Number.isNaN(alpha)) alpha = 0.5;
    alpha = Math.min(1, Math.max(0, alpha));

    if (!["keyword", "semantic", "hybrid"].includes(mode)) {
      sendJson(res, 400, { error: `Invalid mode: ${mode}` });
      return;
    }

    performSearch(q, mode, alpha)
      .then((results) => {
        sendJson(res, 200, { mode, results });
      })
      .catch((err) => {
        console.error("Search error:", err);
        sendJson(res, 500, { error: String(err.message || err) });
      });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

async function main() {
  await setupTypesense();
  server.listen(APP_PORT, APP_HOST, () => {
    console.log(`Knowledge-base search app listening on http://${APP_HOST}:${APP_PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
