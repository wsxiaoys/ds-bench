"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const HOST = "0.0.0.0";

const TYPESENSE_HOST = "127.0.0.1";
const TYPESENSE_PORT = 8108;
const TYPESENSE_PROTOCOL = "http";
const TYPESENSE_API_KEY = fs
  .readFileSync("/etc/typesense-api-key", "utf8")
  .trim();

const TYPESENSE_BASE = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}`;
const COLLECTION = "leaderboard";

const SEED_PLAYERS = [
  { id: "p1", name: "Alice", score: 100 },
  { id: "p2", name: "Bob", score: 100 },
  { id: "p3", name: "Carol", score: 90 },
  { id: "p4", name: "Dave", score: 80 },
  { id: "p5", name: "Eve", score: 70 },
];

// ---------------------------------------------------------------------------
// Typesense HTTP helpers
// ---------------------------------------------------------------------------

async function tsFetch(pathAndQuery, options = {}) {
  const res = await fetch(`${TYPESENSE_BASE}${pathAndQuery}`, {
    ...options,
    headers: {
      "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function collectionExists() {
  const res = await tsFetch(`/collections/${COLLECTION}`);
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  const body = await res.text();
  throw new Error(`Unexpected status checking collection: ${res.status} ${body}`);
}

async function createCollection() {
  const schema = {
    name: COLLECTION,
    fields: [
      { name: "name", type: "string", sort: true },
      { name: "score", type: "int32" },
    ],
    default_sorting_field: "score",
  };
  const res = await tsFetch("/collections", {
    method: "POST",
    body: JSON.stringify(schema),
  });
  if (res.status !== 200 && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Failed to create collection: ${res.status} ${body}`);
  }
}

async function seedPlayers() {
  for (const p of SEED_PLAYERS) {
    const doc = { id: p.id, name: p.name, score: p.score };
    const res = await tsFetch(
      `/collections/${COLLECTION}/documents?action=upsert`,
      {
        method: "POST",
        body: JSON.stringify(doc),
      }
    );
    if (res.status !== 200 && res.status !== 201) {
      const body = await res.text();
      throw new Error(`Failed to seed player ${p.id}: ${res.status} ${body}`);
    }
  }
}

async function waitForTypesense(maxAttempts = 60, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${TYPESENSE_BASE}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body && body.ok) return;
      }
    } catch (err) {
      // ignore, retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Timed out waiting for Typesense to become healthy");
}

async function ensureCollectionReady() {
  await waitForTypesense();
  const exists = await collectionExists();
  if (!exists) {
    await createCollection();
    await seedPlayers();
  }
}

async function fetchLeaderboard() {
  const params = new URLSearchParams({
    q: "*",
    query_by: "name",
    sort_by: "score:desc,name:asc",
    per_page: "250",
  });
  const res = await tsFetch(
    `/collections/${COLLECTION}/documents/search?${params.toString()}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to search leaderboard: ${res.status} ${body}`);
  }
  const data = await res.json();
  const hits = data.hits || [];
  return hits.map((h, idx) => ({
    rank: idx + 1,
    player_id: h.document.id,
    name: h.document.name,
    score: h.document.score,
  }));
}

async function getPlayerDoc(playerId) {
  const res = await tsFetch(
    `/collections/${COLLECTION}/documents/${encodeURIComponent(playerId)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch player ${playerId}: ${res.status} ${body}`);
  }
  return res.json();
}

async function updatePlayerScore(playerId, newScore) {
  const res = await tsFetch(
    `/collections/${COLLECTION}/documents/${encodeURIComponent(playerId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ score: newScore }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update player ${playerId}: ${res.status} ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Per-player serialization so concurrent additive updates are never lost.
// Typesense has no atomic increment, so we serialize read-modify-write per
// player id within this process (the sole writer of scores).
// ---------------------------------------------------------------------------

const playerLocks = new Map();

function runExclusive(playerId, fn) {
  const prevTail = playerLocks.get(playerId) || Promise.resolve();
  const runPromise = prevTail.then(fn, fn);
  // Keep the chain alive regardless of success/failure, but never let a
  // rejection propagate into the map's stored tail.
  const tail = runPromise.then(
    () => {},
    () => {}
  );
  playerLocks.set(playerId, tail);
  return runPromise;
}

async function applyDelta(playerId, delta) {
  return runExclusive(playerId, async () => {
    const doc = await getPlayerDoc(playerId);
    if (!doc) {
      const err = new Error("player_not_found");
      err.code = "NOT_FOUND";
      throw err;
    }
    const newScore = doc.score + delta;
    const updated = await updatePlayerScore(playerId, newScore);
    return {
      player_id: updated.id,
      name: updated.name,
      score: updated.score,
    };
  });
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, "public", "index.html"),
  "utf8"
);

app.get("/", (req, res) => {
  res.type("html").send(INDEX_HTML);
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const board = await fetchLeaderboard();
    res.status(200).json(board);
  } catch (err) {
    console.error("GET /api/leaderboard error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/score", async (req, res) => {
  const body = req.body || {};
  const { player_id, delta } = body;

  if (typeof player_id !== "string" || player_id.length === 0) {
    return res.status(400).json({ error: "player_id is required" });
  }
  if (delta === undefined || delta === null) {
    return res.status(400).json({ error: "delta is required" });
  }
  if (typeof delta !== "number" || !Number.isInteger(delta)) {
    return res.status(400).json({ error: "delta must be an integer" });
  }

  try {
    const updated = await applyDelta(player_id, delta);
    res.status(200).json(updated);
  } catch (err) {
    if (err && err.code === "NOT_FOUND") {
      return res.status(404).json({ error: "player_id not found" });
    }
    console.error("POST /api/score error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

async function main() {
  await ensureCollectionReady();
  app.listen(PORT, HOST, () => {
    console.log(`Leaderboard server listening on http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
