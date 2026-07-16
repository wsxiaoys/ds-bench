import { ApiClient } from './api-client';
import { ApiRequestError } from './types';

/**
 * Round-trip CLI runner.
 *
 * Assumes the mock server is already running on http://localhost:8787.
 * Drives the typed client through the required scenario and prints a single
 * machine-readable summary line starting with `RESULT: `.
 */

const BASE_URL = 'http://localhost:8787';
const API_KEY = 'local-dev-key-123';

async function main(): Promise<void> {
  const client = new ApiClient(BASE_URL);

  // 1. List all products.
  const products = await client.listProducts();
  const productCount = products.length;

  // 2. Fetch the product with id 2.
  const product2 = await client.getProduct(2);
  const product2Name = product2.name;

  // 3. Create an order for productId 3, quantity 2, using the correct API key.
  const order = await client.createOrder(
    { productId: 3, quantity: 2 },
    API_KEY,
  );
  const orderId = order.orderId;
  const orderTotal = order.total;

  // 4. Attempt to fetch product 999 and capture the HTTP status from the error.
  let missingProductStatus = 0;
  try {
    await client.getProduct(999);
  } catch (err) {
    if (err instanceof ApiRequestError) {
      missingProductStatus = err.status;
    } else {
      throw err;
    }
  }

  // 5. Attempt to create an order with an incorrect API key and capture the
  //    HTTP status from the error.
  let unauthorizedStatus = 0;
  try {
    await client.createOrder(
      { productId: 3, quantity: 2 },
      'wrong-key',
    );
  } catch (err) {
    if (err instanceof ApiRequestError) {
      unauthorizedStatus = err.status;
    } else {
      throw err;
    }
  }

  const summary = {
    productCount,
    product2Name,
    orderId,
    orderTotal,
    missingProductStatus,
    unauthorizedStatus,
  };

  console.log(`RESULT: ${JSON.stringify(summary)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Round-trip failed:', err);
  process.exit(1);
});