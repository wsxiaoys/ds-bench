#!/usr/bin/env python3
"""Knowledge-base search web app backed by Typesense."""

import json
import math
import urllib.parse
from pathlib import Path

import flask
import requests

app = flask.Flask(__name__, static_folder=None)

TYPESENSE_URL = "http://127.0.0.1:8108"
API_KEY = Path("/etc/typesense-api-key").read_text().strip()
HEADERS = {"X-TYPESENSE-API-KEY": API_KEY}
COLLECTION = "knowledge_base"

# Load pre-computed query vectors
with open(Path(__file__).parent / "data" / "query_vectors.json") as f:
    QUERY_VECTORS = json.load(f)


def _keyword_search(query: str) -> list[dict]:
    """Perform keyword search via Typesense."""
    params = {
        "q": query,
        "query_by": "title,body",
        "per_page": 20,
    }
    resp = requests.get(
        f"{TYPESENSE_URL}/collections/{COLLECTION}/documents/search",
        headers=HEADERS,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    results = []
    for hit in data.get("hits", []):
        doc = hit["document"]
        score = float(hit.get("text_match", 0))
        results.append({"id": doc["id"], "title": doc["title"], "score": score})
    return results


def _semantic_search(query_vector: list[float]) -> list[dict]:
    """Perform semantic (vector) search via Typesense."""
    vec_str = ",".join(str(v) for v in query_vector)
    vector_query = f"embedding:([{vec_str}], k:20)"

    params = {
        "q": "*",
        "per_page": 20,
        "vector_query": vector_query,
    }
    resp = requests.get(
        f"{TYPESENSE_URL}/collections/{COLLECTION}/documents/search",
        headers=HEADERS,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    results = []
    for hit in data.get("hits", []):
        doc = hit["document"]
        vec_dist = hit.get("vector_distance", 1.0)
        # Convert distance to similarity score (0 = completely dissimilar, higher = more similar)
        score = 1.0 - float(vec_dist)
        results.append({"id": doc["id"], "title": doc["title"], "score": score})
    return results


def _hybrid_search(query: str, query_vector: list[float], alpha: float) -> list[dict]:
    """Perform hybrid search via Typesense with alpha weight."""
    vec_str = ",".join(str(v) for v in query_vector)
    vector_query = f"embedding:([{vec_str}], alpha:{alpha}, k:20)"

    params = {
        "q": query,
        "query_by": "title,body",
        "per_page": 20,
        "vector_query": vector_query,
    }
    resp = requests.get(
        f"{TYPESENSE_URL}/collections/{COLLECTION}/documents/search",
        headers=HEADERS,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    results = []
    for hit in data.get("hits", []):
        doc = hit["document"]
        fusion = hit.get("hybrid_search_info", {}).get("rank_fusion_score", 0)
        score = float(fusion)
        results.append({"id": doc["id"], "title": doc["title"], "score": score})
    return results


@app.route("/api/search")
def api_search():
    """GET /api/search?q=<text>&mode=<keyword|semantic|hybrid>&alpha=<float>"""
    query = flask.request.args.get("q", "")
    mode = flask.request.args.get("mode", "keyword")
    alpha_str = flask.request.args.get("alpha", "0.5")

    if mode not in ("keyword", "semantic", "hybrid"):
        return flask.jsonify({"error": "Invalid mode"}), 400

    try:
        alpha = float(alpha_str)
    except ValueError:
        alpha = 0.5
    alpha = max(0.0, min(1.0, alpha))

    if mode == "keyword":
        results = _keyword_search(query)
    elif mode == "semantic":
        query_vector = QUERY_VECTORS.get(query)
        if query_vector is None:
            return flask.jsonify({"error": f"No pre-computed vector for query: {query}"}), 400
        results = _semantic_search(query_vector)
    else:  # hybrid
        query_vector = QUERY_VECTORS.get(query)
        if query_vector is None:
            return flask.jsonify({"error": f"No pre-computed vector for query: {query}"}), 400
        results = _hybrid_search(query, query_vector, alpha)

    return flask.jsonify({"mode": mode, "results": results})


@app.route("/")
def index():
    """Serve the search UI."""
    return flask.render_template_string(HTML_TEMPLATE)


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Knowledge Base Search</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
    background: #f5f5f5;
    color: #333;
  }
  h1 { margin-bottom: 24px; font-size: 28px; }
  .search-panel {
    background: #fff;
    border-radius: 8px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 24px;
  }
  .control-group { margin-bottom: 16px; }
  .control-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 14px;
  }
  #query-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  #mode-select {
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  #alpha-slider { width: 200px; vertical-align: middle; margin-right: 8px; }
  #alpha-value { font-weight: 600; }
  .alpha-row { display: flex; align-items: center; gap: 12px; }
  #search-button {
    padding: 10px 24px;
    font-size: 16px;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  #search-button:hover { background: #1d4ed8; }
  #results { margin-top: 8px; }
  .result-item {
    background: #fff;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .result-title { font-size: 16px; font-weight: 600; }
  .result-score {
    font-size: 13px;
    color: #666;
    background: #f0f0f0;
    padding: 4px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }
  .error { color: #dc2626; background: #fef2f2; padding: 12px; border-radius: 4px; }
  .hint { color: #888; font-size: 14px; margin-top: 8px; }
</style>
</head>
<body>
<h1>Knowledge Base Search</h1>
<div class="search-panel">
  <div class="control-group">
    <label for="query-input">Query</label>
    <input type="text" id="query-input" placeholder="Enter your search query..." value="speed up slow website">
  </div>
  <div class="control-group">
    <label for="mode-select">Search Mode</label>
    <select id="mode-select">
      <option value="keyword">Keyword</option>
      <option value="semantic">Semantic</option>
      <option value="hybrid">Hybrid</option>
    </select>
  </div>
  <div class="control-group" id="alpha-group">
    <label for="alpha-slider">Alpha (Hybrid Weight)</label>
    <div class="alpha-row">
      <input type="range" id="alpha-slider" min="0" max="1" step="0.1" value="0.5">
      <span id="alpha-value">0.5</span>
    </div>
  </div>
  <button id="search-button">Search</button>
  <p class="hint">Try: "speed up slow website", "how to make my app faster", "store data in tables"</p>
</div>
<div id="results"></div>

<script>
const alphaSlider = document.getElementById('alpha-slider');
const alphaValue = document.getElementById('alpha-value');
const alphaGroup = document.getElementById('alpha-group');
const modeSelect = document.getElementById('mode-select');
const queryInput = document.getElementById('query-input');
const searchButton = document.getElementById('search-button');
const resultsDiv = document.getElementById('results');

alphaSlider.addEventListener('input', function() {
  alphaValue.textContent = parseFloat(this.value).toFixed(1);
});

modeSelect.addEventListener('change', function() {
  alphaGroup.style.display = this.value === 'hybrid' ? '' : 'none';
});

// Initial state
alphaGroup.style.display = modeSelect.value === 'hybrid' ? '' : 'none';

async function doSearch() {
  const q = queryInput.value.trim();
  if (!q) return;

  const mode = modeSelect.value;
  let url = '/api/search?q=' + encodeURIComponent(q) + '&mode=' + mode;
  if (mode === 'hybrid') {
    url += '&alpha=' + parseFloat(alphaSlider.value).toFixed(1);
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.json();
      resultsDiv.innerHTML = '<div class="error">' + (err.error || 'Search failed') + '</div>';
      return;
    }
    const data = await resp.json();
    if (!data.results || data.results.length === 0) {
      resultsDiv.innerHTML = '<p>No results found.</p>';
      return;
    }
    let html = '';
    for (const r of data.results) {
      html += '<div class="result-item">' +
        '<span class="result-title">' + escapeHtml(r.title) + '</span>' +
        '<span class="result-score">Score: ' + formatScore(r.score) + '</span>' +
        '</div>';
    }
    resultsDiv.innerHTML = html;
  } catch (e) {
    resultsDiv.innerHTML = '<div class="error">Network error: ' + e.message + '</div>';
  }
}

function formatScore(s) {
  if (s > 1000) return s.toExponential(4);
  return s.toFixed(4);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

searchButton.addEventListener('click', doSearch);
queryInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doSearch();
});

// Auto-search on load
doSearch();
</script>
</body>
</html>"""


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=False)
