// Local mock authentication server for the Capacitor session task.
// Serves the built web assets from ../dist and exposes a small cookie-based
// auth API. This file is a fixed fixture and must not be modified by the task.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Valid demo credentials.
const USERS = { demo: 'capacitor', alice: 'wonderland' };
// In-memory session store: token -> username.
const sessions = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function sendJson(res, status, obj, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const normalized = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(DIST_DIR, normalized);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    try {
      const content = await readFile(path.join(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/login' && req.method === 'POST') {
    const raw = await readBody(req);
    let body = {};
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      body = {};
    }
    const { username, password } = body;
    if (username && USERS[username] !== undefined && USERS[username] === password) {
      const token = randomUUID();
      sessions.set(token, username);
      sendJson(res, 200, { username }, {
        'Set-Cookie': 'session=' + token + '; Path=/; SameSite=Lax',
      });
    } else {
      sendJson(res, 401, { error: 'invalid credentials' });
    }
    return;
  }

  if (url === '/api/me' && req.method === 'GET') {
    const token = parseCookies(req).session;
    if (token && sessions.has(token)) {
      sendJson(res, 200, { username: sessions.get(token) });
    } else {
      sendJson(res, 401, { error: 'unauthorized' });
    }
    return;
  }

  if (url === '/api/logout' && req.method === 'POST') {
    const token = parseCookies(req).session;
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('Mock session server listening on http://' + HOST + ':' + PORT);
});
