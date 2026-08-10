const fs = require("fs");
const path = require("path");
const express = require("express");
const Typesense = require("typesense");

const TYPESENSE_HOST = "127.0.0.1";
const TYPESENSE_PORT = 8108;
const TYPESENSE_PROTOCOL = "http";
const TYPESENSE_API_KEY_FILE = "/etc/typesense-api-key";
const CITIES_FILE = path.join(__dirname, "data", "cities.json");
const COLLECTION_NAME = "cities";
const PORT = 3000;

let typesense;

function getApiKey() {
  return fs.readFileSync(TYPESENSE_API_KEY_FILE, "utf-8").trim();
}

function initTypesense() {
  const apiKey = getApiKey();
  typesense = new Typesense.Client({
    nodes: [{ host: TYPESENSE_HOST, port: TYPESENSE_PORT, protocol: TYPESENSE_PROTOCOL }],
    apiKey: apiKey,
    connectionTimeoutSeconds: 10,
  });
}

async function createCollection() {
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: "id", type: "string" },
      { name: "name", type: "string", sort: true },
      { name: "country", type: "string" },
      { name: "population", type: "int32", sort: true },
    ],
    default_sorting_field: "population",
  };

  try {
    await typesense.collections().create(schema);
    console.log("Collection 'cities' created.");
  } catch (err) {
    if (err.httpStatus === 409) {
      console.log("Collection 'cities' already exists, deleting and recreating...");
      await typesense.collections(COLLECTION_NAME).delete();
      await typesense.collections().create(schema);
      console.log("Collection 'cities' recreated.");
    } else {
      throw err;
    }
  }
}

async function indexCities() {
  const cities = JSON.parse(fs.readFileSync(CITIES_FILE, "utf-8"));
  console.log(`Indexing ${cities.length} cities...`);

  await typesense.collections(COLLECTION_NAME).documents().import(cities, { action: "create" });
  console.log("Indexing complete.");
}

async function setupTypesense() {
  initTypesense();
  await createCollection();
  await indexCities();
}

// --- Express App ---

const app = express();

// --- HTML escaping helper ---

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Routes ---

// GET / — HTML search page
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>City Search</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
  .search-container { position: relative; }
  #q { width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #ccc; border-radius: 8px; outline: none; box-sizing: border-box; }
  #q:focus { border-color: #4a90d9; }
  #suggestions { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 1000; list-style: none; margin: 0; padding: 0; }
  .suggestion { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 15px; }
  .suggestion:last-child { border-bottom: none; }
  .suggestion.active { background-color: #e8f0fe; }
  .suggestion:hover { background-color: #f5f5f5; }
  .suggestion.active:hover { background-color: #d2e3fc; }
  .suggestion mark { background-color: #fff3b0; color: #000; padding: 0 1px; border-radius: 2px; }
  .suggestion .country { color: #888; font-size: 13px; margin-left: 8px; }
</style>
</head>
<body>
<h1>City Search</h1>
<div class="search-container">
  <input type="text" id="q" placeholder="Search for a city..." autocomplete="off" autofocus>
  <ul id="suggestions"></ul>
</div>
<script>
(function() {
  var input = document.getElementById("q");
  var suggestionsEl = document.getElementById("suggestions");
  var activeIndex = -1;
  var currentQuery = "";
  var debounceTimer = null;

  function clearSuggestions() {
    suggestionsEl.innerHTML = "";
    activeIndex = -1;
  }

  function setActive(index) {
    var items = suggestionsEl.querySelectorAll(".suggestion");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("active");
    }
    if (index >= 0 && index < items.length) {
      items[index].classList.add("active");
      activeIndex = index;
    } else {
      activeIndex = -1;
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^\${}()|[\\]\\\\]/g, \"\\\\$&\");
  }
  function highlightMatch(text, query) {
    if (!query) return escHtml(text);
    var escapedQuery = escapeRegExp(query);
    var re = new RegExp(\"(\" + escapedQuery + \")\", \"gi\");
    return escHtml(text).replace(re, \"<mark>$1</mark>\");
  }

  async function fetchSuggestions(query) {
    var trimmed = query.trim();
    if (!trimmed) {
      clearSuggestions();
      return;
    }
    try {
      var resp = await fetch("/api/suggest?q=" + encodeURIComponent(trimmed));
      var data = await resp.json();
      renderSuggestions(data, trimmed);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }

  function renderSuggestions(results, query) {
    suggestionsEl.innerHTML = "";
    activeIndex = -1;
    if (!results.length) return;

    for (var i = 0; i < results.length; i++) {
      var city = results[i];
      var li = document.createElement("li");
      li.className = "suggestion";
      li.setAttribute("data-id", city.id);
      li.innerHTML = highlightMatch(city.name, query) + '<span class="country">' + escHtml(city.country) + '</span>';
      li.addEventListener("mousedown", function(e) {
        e.preventDefault();
        window.location.href = "/item/" + encodeURIComponent(this.getAttribute("data-id"));
      });
      li.addEventListener("mouseenter", (function(idx) {
        return function() { setActive(idx); };
      })(i));
      suggestionsEl.appendChild(li);
    }
  }

  input.addEventListener("input", function() {
    var val = input.value;
    currentQuery = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      if (input.value === currentQuery) {
        fetchSuggestions(input.value);
      }
    }, 200);
  });

  input.addEventListener("keydown", function(e) {
    var items = suggestionsEl.querySelectorAll(".suggestion");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      if (activeIndex < items.length - 1) {
        setActive(activeIndex + 1);
      } else {
        setActive(0);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      if (activeIndex > 0) {
        setActive(activeIndex - 1);
      } else {
        setActive(items.length - 1);
      }
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items.length > 0) {
        e.preventDefault();
        var activeItem = items[activeIndex];
        var cityId = activeItem.getAttribute("data-id");
        window.location.href = "/item/" + encodeURIComponent(cityId);
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  });

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".search-container")) {
      clearSuggestions();
    }
  });
})();
</script>
</body>
</html>`);
});

// GET /api/suggest?q=<query>
app.get("/api/suggest", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.json([]);
  }

  try {
    const searchResult = await typesense
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: q,
        query_by: "name",
        sort_by: "population:desc,name:asc",
        per_page: 8,
        prefix: true,
        num_typos: 1,
      });

    const hits = (searchResult.hits || []).map((hit) => ({
      id: hit.document.id,
      name: hit.document.name,
      country: hit.document.country,
      population: hit.document.population,
    }));

    res.json(hits);
  } catch (err) {
    console.error("Search error:", err);
    res.json([]);
  }
});

// GET /item/:id — City detail page
app.get("/item/:id", async (req, res) => {
  const cityId = req.params.id;

  try {
    const searchResult = await typesense
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: "*",
        query_by: "name",
        filter_by: "id:=" + cityId,
        per_page: 1,
      });

    const hit = (searchResult.hits || [])[0];
    if (!hit) {
      return res.status(404).send("<h1>404 — City Not Found</h1>");
    }

    const city = hit.document;
    res.send("<!DOCTYPE html>\n" +
      "<html lang=\"en\">\n" +
      "<head>\n" +
      "<meta charset=\"UTF-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
      "<title>" + esc(city.name) + "</title>\n" +
      "<style>\n" +
      "  body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }\n" +
      "  h1 { margin-bottom: 8px; }\n" +
      "  .detail { font-size: 16px; color: #555; }\n" +
      "  .detail span { font-weight: 600; color: #333; }\n" +
      "  .back { display: inline-block; margin-top: 24px; color: #4a90d9; text-decoration: none; }\n" +
      "  .back:hover { text-decoration: underline; }\n" +
      "</style>\n" +
      "</head>\n" +
      "<body>\n" +
      "<h1>" + esc(city.name) + "</h1>\n" +
      "<p class=\"detail\"><span>Country:</span> " + esc(city.country) + "</p>\n" +
      "<p class=\"detail\"><span>Population:</span> " + city.population.toLocaleString() + "</p>\n" +
      '<a class="back" href="/">&larr; Back to search</a>\n' +
      "</body>\n" +
      "</html>");
  } catch (err) {
    console.error("Detail error:", err);
    res.status(404).send("<h1>404 — City Not Found</h1>");
  }
});

// --- Start ---

async function start() {
  await setupTypesense();

  app.listen(PORT, () => {
    console.log("Server listening on http://localhost:" + PORT);
  });
}

start().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
