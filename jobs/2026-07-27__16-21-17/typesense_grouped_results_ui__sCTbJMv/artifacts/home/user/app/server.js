"use strict";

const express = require("express");
const {
  ensureCollectionAndData,
  groupedSearch,
  fetchAllForBrand,
} = require("./lib/typesense");
const { renderPage } = require("./lib/render");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const GROUP_LIMIT = 3; // max items shown per brand group before "show more"
const GROUPS_PER_PAGE = 3; // max brand groups per page

const app = express();

function parseExpand(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return [...new Set(arr.map(String).filter(Boolean))];
}

app.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    let page = parseInt(req.query.page, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    const expand = parseExpand(req.query.expand);

    let { totalGroups, groups } = await groupedSearch({
      q,
      page,
      groupLimit: GROUP_LIMIT,
      groupsPerPage: GROUPS_PER_PAGE,
    });

    let totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PER_PAGE));

    // Clamp out-of-range page requests and re-fetch.
    if (page > totalPages) {
      page = totalPages;
      ({ totalGroups, groups } = await groupedSearch({
        q,
        page,
        groupLimit: GROUP_LIMIT,
        groupsPerPage: GROUPS_PER_PAGE,
      }));
      totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PER_PAGE));
    }

    // For any expanded brand on this page, fetch the full item list.
    for (const group of groups) {
      if (expand.includes(group.brand) && group.total > GROUP_LIMIT) {
        group.items = await fetchAllForBrand({ q, brand: group.brand });
      }
    }

    const html = renderPage({
      q,
      page,
      totalPages,
      groups,
      expand,
      groupLimit: GROUP_LIMIT,
    });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});

async function start() {
  console.log("Connecting to Typesense and ensuring dataset is loaded...");
  await ensureCollectionAndData();
  console.log("Dataset ready.");

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
