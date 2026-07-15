import { ApiClient, ApiHttpError } from './api-client.js';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8787';
const VALID_API_KEY = 'local-dev-key-123';
const INVALID_API_KEY = 'definitely-not-the-right-key';

interface ResultPayload {
  productCount: number;
  product2Name: string;
  orderId: string;
  orderTotal: number;
  missingProductStatus: number;
  unauthorizedStatus: number;
}

async function main(): Promise<void> {
  const client = new ApiClient({ baseUrl: BASE_URL });

  // 1. List all products
  const products = await client.listProducts();
  const productCount = products.length;

  // 2. Fetch the product with id 2
  const product2 = await client.getProduct(2);
  const product2Name = product2.name;

  // 3. Create an order for productId 3, quantity 2, correct API key
  const order = await client.createOrder(
    { productId: 3, quantity: 2 },
    VALID_API_KEY,
  );
  const orderId = order.orderId;
  const orderTotal = order.total;

  // 4. Attempt to fetch product id 999 -> expect 404
  let missingProductStatus = 0;
  try {
    await client.getProduct(999);
    throw new Error('Expected getProduct(999) to reject with ApiHttpError');
  } catch (err) {
    if (!(err instanceof ApiHttpError)) {
      throw err;
    }
    missingProductStatus = err.status;
  }

  // 5. Attempt to create an order with an incorrect API key -> expect 401
  let unauthorizedStatus = 0;
  try {
    await client.createOrder(
      { productId: 3, quantity: 2 },
      INVALID_API_KEY,
    );
    throw new Error('Expected createOrder with bad key to reject with ApiHttpError');
  } catch (err) {
    if (!(err instanceof ApiHttpError)) {
      throw err;
    }
    unauthorizedStatus = err.status;
  }

  const result: ResultPayload = {
    productCount,
    product2Name,
    orderId,
    orderTotal,
    missingProductStatus,
    unauthorizedStatus,
  };

  // Print exactly one line starting with "RESULT: " followed by a JSON object.
  process.stdout.write(`RESULT: ${JSON.stringify(result)}\n`);
}

main().catch((err) => {
  // Surface failure details on stderr but keep the contract that any
  // RESULT: line we emit is the final, machine-readable outcome.
  // eslint-disable-next-line no-console
  console.error('[roundtrip] failed:', err);
  process.exit(1);
});