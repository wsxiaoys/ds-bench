"use strict";

const fs = require("fs");
const path = require("path");

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || "127.0.0.1";
const TYPESENSE_PORT = process.env.TYPESENSE_PORT || "8108";
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || "http";
const TYPESENSE_API_KEY_FILE =
  process.env.TYPESENSE_API_KEY_FILE || "/etc/typesense-api-key";

function readApiKey() {
  if (process.env.TYPESENSE_API_KEY) {
    return process.env.TYPESENSE_API_KEY.trim();
  }
  return fs.readFileSync(TYPESENSE_API_KEY_FILE, "utf8").trim();
}

const API_KEY = readApiKey();
const BASE_URL = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}`;

const COLLECTION_NAME = "products";
const DATASET_PATH = path.join(__dirname, "..", "data", "products.jsonl");

/**
 * Perform a raw request against the Typesense HTTP API.
 */
async function tsRequest(pathname, { method = "GET", query, body, rawBody } = {}) {
  const url = new URL(BASE_URL + pathname);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    "X-TYPESENSE-API-KEY": API_KEY,
  };

  let fetchBody;
  if (rawBody !== undefined) {
    fetchBody = rawBody;
    headers["Content-Type"] = "text/plain";
  } else if (body !== undefined) {
    fetchBody = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: fetchBody,
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (err) {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const err = new Error(
      `Typesense request failed: ${method} ${pathname} -> ${response.status} ${JSON.stringify(
        parsed
      )}`
    );
    err.status = response.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}

async function collectionExists(name) {
  try {
    await tsRequest(`/collections/${encodeURIComponent(name)}`);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function createCollection() {
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: "name", type: "string" },
      { name: "brand", type: "string", facet: true },
      { name: "popularity", type: "int32" },
      { name: "price", type: "float" },
    ],
  };

  try {
    await tsRequest("/collections", { method: "POST", body: schema });
  } catch (err) {
    // 409 => already exists (race with another process/startup). Safe to ignore.
    if (err.status !== 409) throw err;
  }
}

async function importDataset() {
  const raw = fs.readFileSync(DATASET_PATH, "utf8");
  // Normalize to plain LF-separated JSON lines, dropping empty trailing lines.
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const body = lines.join("\n");

  const result = await tsRequest(
    `/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/import`,
    {
      method: "POST",
      query: { action: "upsert" },
      rawBody: body,
    }
  );

  // The import endpoint returns newline-delimited JSON result objects as text,
  // but our tsRequest tries JSON.parse on the whole thing which will fail for
  // multi-line responses; handle that case here.
  if (result && result.raw) {
    const resultLines = result.raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of resultLines) {
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        continue;
      }
      if (obj && obj.success === false) {
        console.error("Failed to import document:", obj);
      }
    }
  }
}

/**
 * Ensure the `products` collection exists and is loaded with the dataset.
 * Safe to call multiple times (idempotent upsert).
 */
async function ensureCollectionAndData() {
  const exists = await collectionExists(COLLECTION_NAME);
  if (!exists) {
    await createCollection();
  }
  await importDataset();
}

function escapeFilterValue(value) {
  // Wrap in backticks to safely handle commas/special characters per
  // Typesense filter_by string literal syntax.
  return "`" + String(value).replace(/`/g, "") + "`";
}

/**
 * Search the collection, grouping hits by brand.
 * Returns { totalGroups, groups: [{ brand, total, items }] }
 */
async function groupedSearch({ q, page, groupLimit, groupsPerPage }) {
  const query = {
    q: q && q.trim() ? q.trim() : "*",
    query_by: "name",
    group_by: "brand",
    group_limit: groupLimit,
    sort_by: "popularity:desc",
    per_page: groupsPerPage,
    page,
  };

  const data = await tsRequest(
    `/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/search`,
    { query }
  );

  const totalGroups = data.found || 0;
  const groups = (data.grouped_hits || []).map((gh) => ({
    brand: gh.group_key[0],
    total: gh.found,
    items: gh.hits.map((h) => h.document),
  }));

  return { totalGroups, groups };
}

/**
 * Fetch every matching item for a single brand (used to satisfy "show more").
 */
async function fetchAllForBrand({ q, brand }) {
  const query = {
    q: q && q.trim() ? q.trim() : "*",
    query_by: "name",
    filter_by: `brand:=${escapeFilterValue(brand)}`,
    sort_by: "popularity:desc",
    per_page: 250,
    page: 1,
  };

  const data = await tsRequest(
    `/collections/${encodeURIComponent(COLLECTION_NAME)}/documents/search`,
    { query }
  );

  return (data.hits || []).map((h) => h.document);
}

module.exports = {
  ensureCollectionAndData,
  groupedSearch,
  fetchAllForBrand,
  COLLECTION_NAME,
};
