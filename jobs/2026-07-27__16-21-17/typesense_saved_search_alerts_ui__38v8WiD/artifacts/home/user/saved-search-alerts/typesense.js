const fs = require("fs");

const TYPESENSE_URL = process.env.TYPESENSE_URL || "http://127.0.0.1:8108";
const API_KEY_FILE = process.env.TYPESENSE_API_KEY_FILE || "/etc/typesense-api-key";
const COLLECTION = "products";

let apiKey = null;
function getApiKey() {
  if (apiKey === null) {
    apiKey = fs.readFileSync(API_KEY_FILE, "utf8").trim();
  }
  return apiKey;
}

async function tsFetch(path, options = {}) {
  const url = `${TYPESENSE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-TYPESENSE-API-KEY": getApiKey(),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

// Ensure the `products` collection exists with the expected schema.
async function ensureCollection() {
  const res = await tsFetch(`/collections/${COLLECTION}`);
  if (res.status === 200) {
    return;
  }
  if (res.status !== 404) {
    const body = await res.text();
    throw new Error(`Failed to check collection: ${res.status} ${body}`);
  }

  const createRes = await tsFetch("/collections", {
    method: "POST",
    body: JSON.stringify({
      name: COLLECTION,
      fields: [
        { name: "name", type: "string" },
        { name: "category", type: "string", facet: true },
        { name: "price", type: "float" },
      ],
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create collection: ${createRes.status} ${body}`);
  }
}

// Upsert an array of product documents ({id, name, category, price}).
// Uses Typesense's import endpoint with action=upsert so re-indexing the
// same document id updates it in place instead of creating a duplicate.
async function upsertDocuments(docs) {
  if (!docs || docs.length === 0) return 0;

  const body = docs.map((d) => JSON.stringify(d)).join("\n");
  const res = await tsFetch(
    `/collections/${COLLECTION}/documents/import?action=upsert`,
    {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain" },
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to import documents: ${res.status} ${text}`);
  }

  const results = text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    throw new Error(`Some documents failed to import: ${JSON.stringify(failures)}`);
  }

  return results.length;
}

function escapeFilterValue(value) {
  // Typesense allows backtick-wrapped filter values, which safely handles
  // values containing spaces, commas, etc. Backticks themselves are not
  // expected in category names for this application.
  return `\`${String(value)}\``;
}

// Runs a saved-search definition against the live Typesense index and
// returns the *complete* set of matching document ids (across all pages).
async function searchAllMatchingIds({ q, category, max_price }) {
  const trimmedQ = (q || "").trim();
  const qParam = trimmedQ === "" ? "*" : trimmedQ;

  const filters = [];
  if (category && String(category).trim() !== "") {
    filters.push(`category:=${escapeFilterValue(category)}`);
  }
  if (max_price !== null && max_price !== undefined && max_price !== "") {
    filters.push(`price:<=${Number(max_price)}`);
  }

  const perPage = 250;
  const ids = new Set();
  let page = 1;
  let found = Infinity;

  while ((page - 1) * perPage < found) {
    const params = new URLSearchParams();
    params.set("q", qParam);
    params.set("query_by", "name");
    if (filters.length > 0) params.set("filter_by", filters.join(" && "));
    params.set("per_page", String(perPage));
    params.set("page", String(page));
    params.set("include_fields", "id");

    const res = await tsFetch(
      `/collections/${COLLECTION}/documents/search?${params.toString()}`
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Search failed: ${res.status} ${JSON.stringify(data)}`);
    }

    found = data.found;
    for (const hit of data.hits || []) {
      ids.add(hit.document.id);
    }

    if (!data.hits || data.hits.length < perPage) break;
    page++;
  }

  return ids;
}

module.exports = {
  ensureCollection,
  upsertDocuments,
  searchAllMatchingIds,
};
