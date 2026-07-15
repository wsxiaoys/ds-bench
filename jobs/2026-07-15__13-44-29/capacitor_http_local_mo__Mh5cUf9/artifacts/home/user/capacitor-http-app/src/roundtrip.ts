import { ApiClient, HttpError } from './client';

async function run() {
  const client = new ApiClient('http://localhost:8787');

  let productCount = 0;
  let product2Name = '';
  let orderId = '';
  let orderTotal = 0;
  let missingProductStatus = 0;
  let unauthorizedStatus = 0;

  try {
    // 1. List all products.
    const products = await client.getProducts();
    productCount = products.length;

    // 2. Fetch the product with id 2.
    const product2 = await client.getProduct(2);
    product2Name = product2.name;

    // 3. Create an order for productId 3, quantity 2, using correct API key.
    const order = await client.createOrder({ productId: 3, quantity: 2 }, 'local-dev-key-123');
    orderId = order.orderId;
    orderTotal = order.total;

    // 4. Attempt to fetch the product with id 999 and capture HTTP status.
    try {
      await client.getProduct(999);
    } catch (err) {
      if (err instanceof HttpError) {
        missingProductStatus = err.status;
      } else {
        console.error('Unexpected error fetching missing product:', err);
      }
    }

    // 5. Attempt to create an order using an incorrect API key and capture HTTP status.
    try {
      await client.createOrder({ productId: 3, quantity: 2 }, 'incorrect-key');
    } catch (err) {
      if (err instanceof HttpError) {
        unauthorizedStatus = err.status;
      } else {
        console.error('Unexpected error creating unauthorized order:', err);
      }
    }

    // Print exactly one line starting with RESULT:
    const result = {
      productCount,
      product2Name,
      orderId,
      orderTotal,
      missingProductStatus,
      unauthorizedStatus
    };

    console.log(`RESULT: ${JSON.stringify(result)}`);
    process.exit(0);
  } catch (error) {
    console.error('Error during roundtrip scenario:', error);
    process.exit(1);
  }
}

run();
