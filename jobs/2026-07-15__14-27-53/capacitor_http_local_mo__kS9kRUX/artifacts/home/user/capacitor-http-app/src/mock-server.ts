import http from 'node:http';
import { randomUUID } from 'node:crypto';

export interface Product {
  id: number;
  name: string;
  price: number;
}

export interface OrderRequestBody {
  productId: number;
  quantity: number;
}

export interface OrderResponseBody {
  orderId: string;
  productId: number;
  quantity: number;
  total: number;
}

const PRODUCTS: Product[] = [
  { id: 1, name: 'Notebook', price: 5 },
  { id: 2, name: 'Pen', price: 2 },
  { id: 3, name: 'Backpack', price: 40 },
];

const API_KEY = 'local-dev-key-123';
const PORT = 8787;

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', (err) => reject(err));
  });
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const rawUrl = req.url ?? '/';
  // Strip query string for routing
  const pathOnly = rawUrl.split('?')[0];
  const method = (req.method ?? 'GET').toUpperCase();

  // GET /api/products
  if (method === 'GET' && pathOnly === '/api/products') {
    sendJson(res, 200, PRODUCTS);
    return;
  }

  // GET /api/products/:id
  const productMatch = pathOnly.match(/^\/api\/products\/(\d+)$/);
  if (method === 'GET' && productMatch) {
    const id = Number(productMatch[1]);
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) {
      sendJson(res, 404, { error: `Product with id ${id} not found` });
      return;
    }
    sendJson(res, 200, product);
    return;
  }

  // POST /api/orders
  if (method === 'POST' && pathOnly === '/api/orders') {
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey !== 'string' || apiKey !== API_KEY) {
      sendJson(res, 401, { error: 'Invalid or missing API key' });
      return;
    }

    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Could not read request body' });
      return;
    }

    let parsed: Partial<OrderRequestBody>;
    try {
      parsed = raw.length === 0 ? {} : JSON.parse(raw);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const productId = (parsed as OrderRequestBody).productId;
    const quantity = (parsed as OrderRequestBody).quantity;

    if (typeof quantity !== 'number' || quantity < 1) {
      sendJson(res, 400, { error: 'Quantity must be a number >= 1' });
      return;
    }

    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      sendJson(res, 404, { error: `Product with id ${productId} not found` });
      return;
    }

    const order: OrderResponseBody = {
      orderId: randomUUID(),
      productId: product.id,
      quantity,
      total: product.price * quantity,
    };
    sendJson(res, 201, order);
    return;
  }

  sendJson(res, 404, { error: `No route for ${method} ${pathOnly}` });
}

export function createMockServer(): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[mock-server] unhandled error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' });
      } else {
        res.end();
      }
    });
  });
}

export function startMockServer(port: number = PORT): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = createMockServer();
    server.once('error', (err) => reject(err));
    // Bind without specifying a host so the server is reachable via both
    // 127.0.0.1 and localhost.
    server.listen(port, () => {
      const addr = server.address();
      // eslint-disable-next-line no-console
      console.log(`[mock-server] listening on port ${port} (${addr})`);
      resolve(server);
    });
  });
}

// Auto-start when invoked directly via `tsx src/mock-server.ts`.
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /mock-server\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  startMockServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[mock-server] failed to start:', err);
    process.exit(1);
  });
}