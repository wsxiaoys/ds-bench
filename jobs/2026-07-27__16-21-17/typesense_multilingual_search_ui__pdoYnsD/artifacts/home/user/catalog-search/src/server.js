"use strict";

const path = require("path");
const express = require("express");

const { createClient } = require("./typesenseClient");
const { indexCatalog } = require("./indexer");
const { searchCatalog } = require("./search");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

function createApp(client) {
  const app = express();

  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/search", async (req, res) => {
    try {
      const { q, lang } = req.query;
      const result = await searchCatalog(client, q, lang);
      res.status(200).json(result);
    } catch (err) {
      console.error("Search failed:", err);
      res.status(500).json({ hits: [], error: "search_failed" });
    }
  });

  return app;
}

async function main() {
  const client = createClient();

  console.log("Ensuring Typesense collection exists and is indexed...");
  const { imported } = await indexCatalog(client);
  console.log(`Indexed ${imported} catalog record(s).`);

  const app = createApp(client);
  app.listen(PORT, HOST, () => {
    console.log(`Catalog search server listening on http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error during startup:", err);
    process.exit(1);
  });
}

module.exports = { createApp, main };
