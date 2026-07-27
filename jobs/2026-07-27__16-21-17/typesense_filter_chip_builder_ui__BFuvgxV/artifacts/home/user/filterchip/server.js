"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = 8080;
const TYPESENSE_URL = process.env.TYPESENSE_URL || "http://127.0.0.1:8108";
const API_KEY_FILE = "/etc/typesense-api-key";
const DATA_FILE = path.join(__dirname, "data", "products.jsonl");
const COLLECTION = "products";

const TYPESENSE_API_KEY = fs.readFileSync(API_KEY_FILE, "utf8").trim();

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------
// field -> "string" | "number" | "string[]"
const SCHEMA = {
  id: "string",
  name: "string",
  category: "string",
  brand: "string",
  price: "number",
  rating: "number",
  tags: "string[]",
};
const SCHEMA_FIELDS = new Set(Object.keys(SCHEMA));

// ---------------------------------------------------------------------------
// Typesense HTTP helpers
// ---------------------------------------------------------------------------
async function tsRequest(method, urlPath, body) {
  const res = await fetch(`${TYPESENSE_URL}${urlPath}`, {
    method,
    headers: {
      "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
      "Content-Type":
        body && typeof body === "string" ? "text/plain" : "application/json",
    },
    body: body
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function ensureCollectionIndexed() {
  // Drop any existing collection with this name so that we start fresh and
  // index *exactly* the documents in the dataset file (no additions/omissions).
  await tsRequest("DELETE", `/collections/${COLLECTION}`);

  const schemaBody = {
    name: COLLECTION,
    fields: [
      { name: "name", type: "string" },
      { name: "category", type: "string", facet: true },
      { name: "brand", type: "string", facet: true },
      { name: "price", type: "float" },
      { name: "rating", type: "float" },
      { name: "tags", type: "string[]", facet: true },
    ],
  };

  const created = await tsRequest("POST", "/collections", schemaBody);
  if (created.status >= 300) {
    throw new Error(
      `Failed to create collection: ${JSON.stringify(created.body)}`
    );
  }

  const jsonl = fs.readFileSync(DATA_FILE, "utf8");
  const res = await fetch(
    `${TYPESENSE_URL}/collections/${COLLECTION}/documents/import?action=create`,
    {
      method: "POST",
      headers: {
        "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
        "Content-Type": "text/plain",
      },
      body: jsonl.trim() + "\n",
    }
  );
  const text = await res.text();
  // The import endpoint returns one JSON line per document, each with
  // {"success": true} or {"success": false, "error": "..."}. Verify all ok.
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const failures = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (!parsed.success) failures.push(parsed);
    } catch (e) {
      failures.push({ error: "unparseable import response line", line });
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Document import had failures: ${JSON.stringify(failures)}`
    );
  }
}

async function importAndVerify() {
  await ensureCollectionIndexed();

  // Re-fetch collection info to confirm document count matches dataset.
  const lineCount = fs
    .readFileSync(DATA_FILE, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0).length;

  const info = await tsRequest("GET", `/collections/${COLLECTION}`);
  const numDocs = info.body && info.body.num_documents;
  console.log(
    `[startup] Indexed collection '${COLLECTION}': ${numDocs} documents (expected ${lineCount}).`
  );
  if (numDocs !== lineCount) {
    console.warn(
      `[startup] WARNING: document count mismatch (got ${numDocs}, expected ${lineCount}).`
    );
  }
}

// ---------------------------------------------------------------------------
// Filter tree -> Typesense filter_by translation
// ---------------------------------------------------------------------------

class FilterError extends Error {}

// Escape a string value for safe use as a backtick-quoted Typesense filter
// literal. Backticks are escaped with a backslash, and backslashes are
// escaped so the literal backslash survives the round trip.
function quoteString(value) {
  const s = String(value);
  const escaped = s.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  return "`" + escaped + "`";
}

function formatScalar(field, value) {
  const type = SCHEMA[field];
  if (type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new FilterError(`Invalid numeric value for field '${field}': ${JSON.stringify(value)}`);
    }
    return String(n);
  }
  // string / string[] fields are always compared as quoted string literals
  if (typeof value !== "string" && typeof value !== "number") {
    throw new FilterError(`Invalid value for field '${field}': ${JSON.stringify(value)}`);
  }
  return quoteString(value);
}

const VALID_CMPS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
]);

function buildConditionExpr(node) {
  const { field, cmp, value } = node;

  if (typeof field !== "string" || !SCHEMA_FIELDS.has(field)) {
    throw new FilterError(`Unknown field: ${JSON.stringify(field)}`);
  }
  if (!VALID_CMPS.has(cmp)) {
    throw new FilterError(`Unknown comparator: ${JSON.stringify(cmp)}`);
  }

  const type = SCHEMA[field];
  const isNumeric = type === "number";

  switch (cmp) {
    case "eq":
      return `${field}:=${formatScalar(field, value)}`;
    case "ne":
      return `${field}:!=${formatScalar(field, value)}`;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (!isNumeric) {
        throw new FilterError(
          `Comparator '${cmp}' only applies to numeric fields, got '${field}'`
        );
      }
      const opMap = { gt: ">", gte: ">=", lt: "<", lte: "<=" };
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new FilterError(`Invalid numeric value for '${field}': ${JSON.stringify(value)}`);
      }
      return `${field}:${opMap[cmp]}${n}`;
    }
    case "between": {
      if (!isNumeric) {
        throw new FilterError(
          `Comparator 'between' only applies to numeric fields, got '${field}'`
        );
      }
      if (!Array.isArray(value) || value.length !== 2) {
        throw new FilterError(
          `'between' requires value to be [low, high], got ${JSON.stringify(value)}`
        );
      }
      const lo = Number(value[0]);
      const hi = Number(value[1]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new FilterError(`Invalid range for '${field}': ${JSON.stringify(value)}`);
      }
      return `${field}:[${lo}..${hi}]`;
    }
    case "in": {
      if (!Array.isArray(value) || value.length === 0) {
        throw new FilterError(
          `'in' requires a non-empty array value, got ${JSON.stringify(value)}`
        );
      }
      const parts = value.map((v) => formatScalar(field, v));
      return `${field}:=[${parts.join(",")}]`;
    }
    default:
      throw new FilterError(`Unknown comparator: ${cmp}`);
  }
}

// Recursively compile a Node into either:
//   { alwaysTrue: true }                -> matches every document
//   { alwaysTrue: false, expr: string }  -> a filter_by fragment
function compileNode(node) {
  if (!node || typeof node !== "object") {
    throw new FilterError("Invalid filter node");
  }

  if (node.op === "and" || node.op === "or") {
    const children = Array.isArray(node.children) ? node.children : null;
    if (!children) {
      throw new FilterError("Group node requires a 'children' array");
    }
    if (children.length === 0) {
      return { alwaysTrue: true };
    }

    const compiledChildren = children.map(compileNode);

    if (node.op === "and") {
      const parts = compiledChildren
        .filter((c) => !c.alwaysTrue)
        .map((c) => c.expr);
      if (parts.length === 0) {
        return { alwaysTrue: true };
      }
      if (parts.length === 1) {
        return { alwaysTrue: false, expr: parts[0] };
      }
      return { alwaysTrue: false, expr: `(${parts.join(" && ")})` };
    } else {
      // op === "or"
      if (compiledChildren.some((c) => c.alwaysTrue)) {
        return { alwaysTrue: true };
      }
      const parts = compiledChildren.map((c) => c.expr);
      if (parts.length === 1) {
        return { alwaysTrue: false, expr: parts[0] };
      }
      return { alwaysTrue: false, expr: `(${parts.join(" || ")})` };
    }
  }

  if (typeof node.field !== "undefined" || typeof node.cmp !== "undefined") {
    return { alwaysTrue: false, expr: buildConditionExpr(node) };
  }

  throw new FilterError("Node must be a Group ({op, children}) or a Condition ({field, cmp, value})");
}

// Returns null if the compiled filter matches every document (no filter_by
// needed), otherwise returns the filter_by string.
function compileFilterTree(root) {
  const compiled = compileNode(root);
  if (compiled.alwaysTrue) {
    return null;
  }
  return compiled.expr;
}

// ---------------------------------------------------------------------------
// Query execution: fetch the *complete* set of matching ids, paginating as
// needed since a single Typesense request can return at most 250 hits.
// ---------------------------------------------------------------------------
const PAGE_SIZE = 250;

async function fetchAllMatchingDocs(filterBy) {
  const ids = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = new URLSearchParams({
      q: "*",
      query_by: "name",
      per_page: String(PAGE_SIZE),
      page: String(page),
      include_fields: "id,name",
    });
    if (filterBy) {
      params.set("filter_by", filterBy);
    }
    const result = await tsRequest(
      "GET",
      `/collections/${COLLECTION}/documents/search?${params.toString()}`
    );
    if (result.status >= 300) {
      const msg =
        (result.body && (result.body.message || JSON.stringify(result.body))) ||
        "Unknown Typesense error";
      const err = new Error(msg);
      err.typesense = true;
      throw err;
    }
    const hits = result.body.hits || [];
    for (const h of hits) {
      ids.push({ id: h.document.id, name: h.document.name });
    }
    if (hits.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/schema", (req, res) => {
  res.json({ fields: SCHEMA });
});

app.post("/api/filter", async (req, res) => {
  const body = req.body || {};
  if (!Object.prototype.hasOwnProperty.call(body, "filter")) {
    return res.status(400).json({ error: "Request body must contain a 'filter' field" });
  }

  let filterBy;
  try {
    filterBy = compileFilterTree(body.filter);
  } catch (e) {
    if (e instanceof FilterError) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(400).json({ error: "Invalid filter tree" });
  }

  try {
    const docs = await fetchAllMatchingDocs(filterBy);
    return res.status(200).json({
      ids: docs.map((d) => d.id),
      count: docs.length,
      products: docs,
    });
  } catch (e) {
    return res.status(502).json({ error: `Typesense query failed: ${e.message}` });
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function main() {
  await importAndVerify();
  app.listen(PORT, () => {
    console.log(`[startup] Filter chip builder listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
