"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");

const { indexCities, searchCities } = require("./lib/typesenseClient");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "cities.json");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// In-memory lookup of cities by id, used for the detail view.
let citiesById = new Map();

function loadCitiesFromDisk() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const cities = JSON.parse(raw);
  citiesById = new Map(cities.map((c) => [String(c.id), c]));
  return cities;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDetailPage(city) {
  const name = escapeHtml(city.name);
  const country = escapeHtml(city.country);
  const population = escapeHtml(String(city.population));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${name} — City Details</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main class="detail">
    <a class="back-link" href="/">&larr; Back to search</a>
    <h1 id="city-name">${name}</h1>
    <dl>
      <dt>Country</dt>
      <dd id="city-country">${country}</dd>
      <dt>Population</dt>
      <dd id="city-population">${population}</dd>
    </dl>
  </main>
</body>
</html>`;
}

app.get("/api/suggest", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchCities(q, 8);
    res.status(200).json(results);
  } catch (err) {
    console.error("Error handling /api/suggest:", err);
    res.status(200).json([]);
  }
});

app.get("/item/:id", (req, res) => {
  const city = citiesById.get(String(req.params.id));
  if (!city) {
    res.status(404).send("City not found");
    return;
  }
  res.status(200).send(renderDetailPage(city));
});

async function start() {
  const cities = loadCitiesFromDisk();
  try {
    await indexCities(cities);
    console.log(`Indexed ${cities.length} cities into Typesense.`);
  } catch (err) {
    console.error("Failed to index cities into Typesense:", err);
  }

  app.listen(PORT, () => {
    console.log(`Typeahead app listening on port ${PORT}`);
  });
}

start();
