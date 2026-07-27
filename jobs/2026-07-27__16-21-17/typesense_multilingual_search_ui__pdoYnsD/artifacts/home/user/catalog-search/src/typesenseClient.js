"use strict";

const fs = require("fs");
const Typesense = require("typesense");

const API_KEY_FILE = "/etc/typesense-api-key";

function readApiKey() {
  // Allow overriding via env var for local development/testing, but default
  // to reading the key from the well-known file used during verification.
  if (process.env.TYPESENSE_API_KEY) {
    return process.env.TYPESENSE_API_KEY;
  }
  return fs.readFileSync(API_KEY_FILE, "utf8").trim();
}

function createClient() {
  const host = process.env.TYPESENSE_HOST || "127.0.0.1";
  const port = Number(process.env.TYPESENSE_PORT || 8108);
  const protocol = process.env.TYPESENSE_PROTOCOL || "http";
  const apiKey = readApiKey();

  return new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey,
    connectionTimeoutSeconds: 10,
  });
}

module.exports = { createClient };
