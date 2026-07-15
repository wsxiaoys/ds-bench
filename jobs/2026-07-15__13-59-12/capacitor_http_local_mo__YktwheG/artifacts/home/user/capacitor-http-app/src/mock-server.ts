import http from 'node:http';
import crypto from 'node:crypto';
import type { Product } from './types';

/**
 * A tiny in-process mock HTTP API server implemented with Node's built-in
 * `http` module. Listens on `http://localhost:8787` (reachable via both
 * `127.0.0.1` and `localhost`) and exposes product/order endpoints.
 */

const PORT = 8787;
const API_KEY = 'local-dev-key-123';

const products: Product[] = [
  { id: 1, name: 'Notebook', price: 5 },
  { id: 2, name: 'Pen', price: 2 },
  { id: 3, name: 'Backpack', price: 40 },
];

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // GET /api/products
    if (req.method === 'GET' && pathname === '/api/products') {
      sendJson(res, 200, products);
      return;
    }

    // GET /api/products/:id
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (req.method === 'GET' && productMatch) {
      const id = Number(productMatch[1]);
      const product = products.find((p) => p.id === id);
      if (!product) {
        sendJson(res, 404, { error: `Product with id ${id} not found` });
        return;
      }
      sendJson(res, 200, product);
      return;
    }

    // POST /api/orders
    if (req.method === 'POST' && pathname === '/api/orders') {
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== API_KEY) {
        sendJson(res, 401, { error: 'Invalid or missing API key' });
        return;
      }

      const raw = await readBody(req);
      let parsed: { productId?: unknown; quantity?: unknown };
      try {
        parsed = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const productId = Number(parsed.productId);
      const quantity = Number(parsed.quantity);

      const product = products.find((p) => p.id === productId);
      if (!product) {
        sendJson(res, 404, { error: `Product with id ${productId} not found` });
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        sendJson(res, 400, { error: 'Quantity must be a positive integer' });
        return;
      }

      const orderId = crypto.randomUUID();
      const total = product.price * quantity;
      sendJson(res, 201, {
        orderId,
        productId: product.id,
        quantity,
        total,
      });
      return;
    }

    // Fallback
    sendJson(res, 404, { error: `Route ${req.method} ${pathname} not found` });
  } catch (err) {
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});

export { server };