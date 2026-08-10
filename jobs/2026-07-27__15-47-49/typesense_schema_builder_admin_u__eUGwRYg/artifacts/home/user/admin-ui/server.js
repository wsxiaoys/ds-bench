import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TYPESENSE_URL = "http://127.0.0.1:8108";
const API_KEY_FILE = "/etc/typesense-api-key";
const RUN_ID_FILE = "/logs/artifacts/run-id";

function getApiKey() {
  return fs.readFileSync(API_KEY_FILE, "utf-8").trim();
}

function getRunId() {
  return fs.readFileSync(RUN_ID_FILE, "utf-8").trim();
}

function typesenseHeaders() {
  return {
    "X-TYPESENSE-API-KEY": getApiKey(),
    "Content-Type": "application/json",
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function typesenseRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, TYPESENSE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: typesenseHeaders(),
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// --- API Routes ---

async function handleCreateCollection(body) {
  const { name, fields } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return { status: 400, error: "Collection name is required." };
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return { status: 400, error: "At least one field is required." };
  }

  // Validate fields
  const validTypes = new Set(["string", "int", "float", "bool", "string[]"]);
  const seenNames = new Set();
  for (const f of fields) {
    if (!f.name || typeof f.name !== "string" || f.name.trim() === "") {
      return { status: 400, error: "Each field must have a non-empty name." };
    }
    if (!validTypes.has(f.type)) {
      return {
        status: 400,
        error: `Invalid field type "${f.type}" for field "${f.name}". Supported types: string, int, float, bool, string[].`,
      };
    }
    const lower = f.name.trim().toLowerCase();
    if (seenNames.has(lower)) {
      return {
        status: 400,
        error: `Duplicate field name "${f.name}". Field names must be unique (case-insensitive).`,
      };
    }
    seenNames.add(lower);
  }

  const runId = getRunId();
  const collectionName = `${name.trim()}_${runId}`;

  // Map form types to Typesense types
  const typeMap = {
    string: "string",
    int: "int32",
    float: "float",
    bool: "bool",
    "string[]": "string[]",
  };

  const tsFields = fields.map((f) => ({
    name: f.name.trim(),
    type: typeMap[f.type],
    facet: !!f.facet,
    optional: !!f.optional,
  }));

  // Check if collection already exists
  const existing = await typesenseRequest("GET", `/collections/${collectionName}`);
  if (existing.status === 200) {
    return {
      status: 409,
      error: `Collection "${collectionName}" already exists. Please choose a different base name.`,
    };
  }

  const result = await typesenseRequest("POST", "/collections", {
    name: collectionName,
    fields: tsFields,
  });

  if (result.status === 201 || result.status === 200) {
    return {
      status: 200,
      success: true,
      collectionName,
      message: `Collection "${collectionName}" created successfully.`,
    };
  }

  return {
    status: result.status,
    error: result.body?.message || result.raw || "Failed to create collection.",
  };
}

async function handleImport(body) {
  const { collectionName, data } = body;

  if (!collectionName || !data) {
    return { status: 400, error: "collectionName and data are required." };
  }

  const lines = data.split("\n").filter((line) => line.trim() !== "");

  // First, get the collection schema to know field types and optionality
  const collResult = await typesenseRequest("GET", `/collections/${collectionName}`);
  if (collResult.status !== 200) {
    return {
      status: 404,
      error: `Collection "${collectionName}" not found.`,
    };
  }

  const schemaFields = collResult.body.fields || [];
  const fieldMap = {};
  for (const f of schemaFields) {
    fieldMap[f.name] = { type: f.type, optional: f.optional };
  }

  let imported = 0;
  let rejected = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let doc;
    try {
      doc = JSON.parse(line);
    } catch {
      rejected++;
      continue;
    }

    // Validate and convert fields
    let valid = true;
    const cleaned = {};

    for (const [fieldName, fieldDef] of Object.entries(fieldMap)) {
      const rawValue = doc[fieldName];

      // Field is missing
      if (rawValue === undefined) {
        if (fieldDef.optional) {
          continue; // skip optional fields
        }
        valid = false;
        break;
      }

      // Try to convert the value to match the schema type
      const converted = convertValue(rawValue, fieldDef.type);
      if (converted === undefined) {
        valid = false;
        break;
      }
      cleaned[fieldName] = converted;
    }

    if (!valid) {
      rejected++;
      continue;
    }

    // Include any extra fields from the document that aren't in schema
    for (const [key, value] of Object.entries(doc)) {
      if (!(key in fieldMap)) {
        cleaned[key] = value;
      }
    }

    // Import the document
    const importResult = await typesenseRequest(
      "POST",
      `/collections/${collectionName}/documents`,
      cleaned
    );

    if (importResult.status === 201 || importResult.status === 200) {
      imported++;
    } else {
      rejected++;
    }
  }

  return {
    status: 200,
    imported,
    rejected,
  };
}

function convertValue(value, schemaType) {
  if (value === null || value === undefined) {
    return undefined;
  }

  switch (schemaType) {
    case "string":
      if (typeof value === "string") return value;
      if (typeof value === "number") return String(value);
      if (typeof value === "boolean") return String(value);
      return undefined;

    case "int32":
      if (typeof value === "number" && Number.isInteger(value)) return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^-?\d+$/.test(trimmed)) {
          return parseInt(trimmed, 10);
        }
      }
      // Try parsing as float then check if it's an integer
      if (typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && Number.isInteger(num)) return num;
      }
      return undefined;

    case "float":
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
          return parseFloat(trimmed);
        }
      }
      return undefined;

    case "bool":
      if (typeof value === "boolean") return value;
      if (value === "true" || value === "True" || value === "TRUE") return true;
      if (value === "false" || value === "False" || value === "FALSE") return false;
      if (typeof value === "number") return value !== 0;
      return undefined;

    case "string[]":
      if (Array.isArray(value)) {
        const converted = value.map((v) => {
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          return undefined;
        });
        if (converted.some((v) => v === undefined)) return undefined;
        return converted;
      }
      return undefined;

    default:
      return value;
  }
}

async function handleSearch(body) {
  const { collectionName, query } = body;

  if (!collectionName || !query) {
    return { status: 400, error: "collectionName and query are required." };
  }

  const result = await typesenseRequest(
    "GET",
    `/collections/${collectionName}/documents/search?q=${encodeURIComponent(query)}&query_by=title,brand`
  );

  if (result.status === 200) {
    return {
      status: 200,
      hits: (result.body.hits || []).map((h) => h.document),
    };
  }

  return {
    status: result.status,
    error: result.body?.message || "Search failed.",
  };
}

// --- HTTP Server ---

const server = http.createServer(async (req, res) => {
  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      // Serve the HTML page
      const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-collection") {
      const body = JSON.parse(await readBody(req));
      const result = await handleCreateCollection(body);
      sendJson(res, result.status, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import") {
      const body = JSON.parse(await readBody(req));
      const result = await handleImport(body);
      sendJson(res, result.status, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search") {
      const body = JSON.parse(await readBody(req));
      const result = await handleSearch(body);
      sendJson(res, result.status, result);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error("Server error:", err);
    sendJson(res, 500, { error: err.message });
  }
});

const PORT = 3000;
const HOST = "127.0.0.1";

server.listen(PORT, HOST, () => {
  console.log(`Admin UI server running at http://${HOST}:${PORT}`);
});
