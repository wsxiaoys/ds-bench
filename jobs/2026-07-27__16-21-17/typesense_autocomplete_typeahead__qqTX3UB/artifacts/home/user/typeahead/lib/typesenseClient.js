"use strict";

const fs = require("fs");
const path = require("path");
const Typesense = require("typesense").Client;

const API_KEY_FILE = "/etc/typesense-api-key";
const COLLECTION_NAME = "cities";

function readApiKey() {
  if (process.env.TYPESENSE_API_KEY) {
    return process.env.TYPESENSE_API_KEY.trim();
  }
  return fs.readFileSync(API_KEY_FILE, "utf8").trim();
}

const client = new Typesense({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "127.0.0.1",
      port: Number(process.env.TYPESENSE_PORT) || 8108,
      protocol: process.env.TYPESENSE_PROTOCOL || "http",
    },
  ],
  apiKey: readApiKey(),
  connectionTimeoutSeconds: 10,
});

const schema = {
  name: COLLECTION_NAME,
  fields: [
    { name: "name", type: "string", sort: true },
    { name: "country", type: "string" },
    { name: "population", type: "int32" },
  ],
  default_sorting_field: "population",
};

async function ensureCollection() {
  // Drop any pre-existing collection so the schema always matches what this
  // app expects, then (re)create it and index a fresh copy of the dataset.
  try {
    await client.collections(COLLECTION_NAME).delete();
  } catch (err) {
    if (!err || err.httpStatus !== 404) {
      throw err;
    }
  }
  await client.collections().create(schema);
}

async function indexCities(cities) {
  await ensureCollection();
  if (!cities.length) return;
  const documents = cities.map((c) => ({
    id: String(c.id),
    name: c.name,
    country: c.country,
    population: c.population,
  }));
  await client
    .collections(COLLECTION_NAME)
    .documents()
    .import(documents, { action: "upsert" });
}

async function searchCities(query, limit = 8) {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  const searchParameters = {
    q: trimmed,
    query_by: "name",
    prefix: true,
    num_typos: 2,
    typo_tokens_threshold: 1,
    drop_tokens_threshold: 0,
    per_page: limit,
    sort_by: "population:desc,name:asc",
  };

  const result = await client
    .collections(COLLECTION_NAME)
    .documents()
    .search(searchParameters);

  const hits = result.hits || [];
  return hits.slice(0, limit).map((hit) => {
    const doc = hit.document;
    return {
      id: String(doc.id),
      name: doc.name,
      country: doc.country,
      population: doc.population,
    };
  });
}

module.exports = {
  client,
  COLLECTION_NAME,
  ensureCollection,
  indexCities,
  searchCities,
};
