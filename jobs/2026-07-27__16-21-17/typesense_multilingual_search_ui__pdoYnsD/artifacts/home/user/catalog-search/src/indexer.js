"use strict";

const fs = require("fs");
const path = require("path");
const { COLLECTION_NAME, COLLECTION_SCHEMA } = require("./schema");

const DATA_FILE = path.join(__dirname, "..", "data", "catalog.json");

async function ensureCollection(client) {
  try {
    await client.collections(COLLECTION_NAME).retrieve();
  } catch (err) {
    if (err && err.httpStatus === 404) {
      await client.collections().create(COLLECTION_SCHEMA);
    } else {
      throw err;
    }
  }
}

function loadCatalogData() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) {
    throw new Error(`Expected ${DATA_FILE} to contain a JSON array`);
  }
  return records;
}

async function indexCatalog(client) {
  await ensureCollection(client);
  const records = loadCatalogData();
  if (records.length === 0) {
    return { imported: 0 };
  }
  // Upsert is idempotent: re-running on every startup will not create
  // duplicates and will keep the index in sync with the seed data.
  await client
    .collections(COLLECTION_NAME)
    .documents()
    .import(records, { action: "upsert" });
  return { imported: records.length };
}

module.exports = { ensureCollection, loadCatalogData, indexCatalog, DATA_FILE };
