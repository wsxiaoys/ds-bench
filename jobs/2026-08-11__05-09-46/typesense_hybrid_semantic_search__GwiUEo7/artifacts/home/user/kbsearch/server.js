const http = require('http');
const fs = require('fs');
const path = require('fs');
const url = require('url');

const PORT = 8080;
const HOST = '127.0.0.1';
const TYPESENSE_URL = 'http://127.0.0.1:8108';
const API_KEY = 'lAE7Kftk3EdTiiIpeQNfRBHI1rDVaMQL';

// Load pre-computed query vectors and normalize keys
let queryVectors = {};
try {
  const queryVectorsRaw = JSON.parse(fs.readFileSync('/home/user/kbsearch/data/query_vectors.json', 'utf8'));
  for (const [key, val] of Object.entries(queryVectorsRaw)) {
    queryVectors[key.trim().toLowerCase()] = val;
  }
  console.log('Loaded query vectors:', Object.keys(queryVectors));
} catch (err) {
  console.error('Failed to load query vectors:', err);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve Frontend UI at GET /
  if (req.method === 'GET' && pathname === '/') {
    try {
      const html = fs.readFileSync('/home/user/kbsearch/index.html', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error: ' + err.message);
    }
    return;
  }

  // Serve Search API at GET /api/search
  if (req.method === 'GET' && pathname === '/api/search') {
    try {
      const q = parsedUrl.query.q || '';
      const mode = parsedUrl.query.mode || 'keyword';
      let alpha = parseFloat(parsedUrl.query.alpha);
      if (isNaN(alpha) || alpha < 0.0 || alpha > 1.0) {
        alpha = 0.5;
      }

      const normQ = q.trim().toLowerCase();
      const vector = queryVectors[normQ];

      const typesenseParams = {};

      if (mode === 'keyword') {
        typesenseParams.q = q;
        typesenseParams.query_by = 'title,body';
      } else if (mode === 'semantic') {
        if (!vector) {
          console.log(`Vector not found for query: "${q}"`);
          return sendJson(res, 200, { mode, results: [] });
        }
        typesenseParams.q = '*';
        typesenseParams.vector_query = `embedding:([${vector.join(',')}], k:10)`;
      } else if (mode === 'hybrid') {
        if (!vector) {
          console.log(`Vector not found for query: "${q}"`);
          return sendJson(res, 200, { mode, results: [] });
        }
        typesenseParams.q = q;
        typesenseParams.query_by = 'title,body';
        typesenseParams.vector_query = `embedding:([${vector.join(',')}], k:10, alpha:${alpha})`;
      } else {
        return sendJson(res, 400, { error: `Invalid search mode: ${mode}` });
      }

      // Query Typesense
      const typesenseSearchUrl = new URL(`${TYPESENSE_URL}/collections/knowledge_base/documents/search`);
      for (const [k, v] of Object.entries(typesenseParams)) {
        typesenseSearchUrl.searchParams.set(k, v);
      }

      const typesenseRes = await fetch(typesenseSearchUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });

      if (!typesenseRes.ok) {
        const errText = await typesenseRes.text();
        console.error('Typesense search error:', errText);
        return sendJson(res, 500, { error: 'Search backend error' });
      }

      const searchData = await typesenseRes.json();
      const hits = searchData.hits || [];

      // Map hits to response structure
      const results = hits.map(hit => {
        let score = 0;
        if (mode === 'keyword') {
          score = hit.text_match || (hit.text_match_info && parseFloat(hit.text_match_info.score)) || hit.score || 0;
        } else if (mode === 'semantic') {
          score = 1 - (hit.vector_distance !== undefined ? hit.vector_distance : 1);
        } else if (mode === 'hybrid') {
          score = hit.hybrid_search_info ? hit.hybrid_search_info.rank_fusion_score : 0;
        }

        return {
          id: hit.document.id,
          title: hit.document.title,
          body: hit.document.body,
          score: score
        };
      });

      // Sort results descending by score
      results.sort((a, b) => b.score - a.score);

      return sendJson(res, 200, { mode, results });
    } catch (err) {
      console.error('Search handler error:', err);
      return sendJson(res, 500, { error: 'Internal server error: ' + err.message });
    }
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
