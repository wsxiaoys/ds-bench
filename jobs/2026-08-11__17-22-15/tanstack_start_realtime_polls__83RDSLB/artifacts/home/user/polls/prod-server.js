import http from 'http';
import fs from 'fs';
import path from 'path';
import startServer from './dist/server/server.js';

const PORT = process.env.PORT || 4519;
const PUBLIC_DIR = path.resolve('dist/client');

const server = http.createServer(async (req, res) => {
  try {
    // 1. Try to serve static files from dist/client
    const url = new URL(req.url, 'http://localhost');
    const safePath = path.normalize(url.pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 2. Otherwise, delegate to TanStack Start SSR handler
    const webReq = await getWebRequest(req);
    const webRes = await startServer.fetch(webReq);
    await sendWebResponse(res, webRes);
  } catch (err) {
    console.error('Error handling request:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

async function getWebRequest(req) {
  const method = req.method;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const val of value) headers.append(key, val);
      } else {
        headers.set(key, value);
      }
    }
  }

  const host = req.headers.host || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const url = `${protocol}://${host}${req.url}`;

  let body = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }

  return new Request(url, {
    method,
    headers,
    body,
    duplex: 'half'
  });
}

async function sendWebResponse(res, webRes) {
  res.statusCode = webRes.status;
  res.statusMessage = webRes.statusText;

  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const setCookies = webRes.headers.getSetCookie ? webRes.headers.getSetCookie() : [value];
      res.setHeader('set-cookie', setCookies);
    } else {
      res.setHeader(key, value);
    }
  });

  if (webRes.body) {
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}

server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
