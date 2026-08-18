import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/wasp_db",
    },
  },
});

async function simulateCheckout(clientId: string, productId: string, quantity: number) {
  console.log(`[Client ${clientId}] Starting checkout...`);
  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log(`[Client ${clientId}] Inside transaction, acquiring lock...`);
      
      // Use raw query with FOR UPDATE to lock the product row
      const products = await tx.$queryRaw<any[]>`
        SELECT * FROM "Product"
        WHERE id = ${productId}
        FOR UPDATE
      `;

      if (products.length === 0) {
        throw new Error(`Product not found`);
      }

      const product = products[0];
      console.log(`[Client ${clientId}] Acquired lock. Current inventory: ${product.inventory}`);

      // Simulate some processing delay to ensure overlap and concurrency
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (product.inventory < quantity) {
        throw new Error(`Insufficient inventory for product: ${product.name}`);
      }

      // Decrement the inventory
      await tx.product.update({
        where: { id: product.id },
        data: { inventory: product.inventory - quantity },
      });

      // Create Order
      const order = await tx.order.create({
        data: {
          subtotal: product.price * quantity,
          discount: 0,
          total: product.price * quantity,
        },
      });

      console.log(`[Client ${clientId}] Order created successfully! Order ID: ${order.id}`);
      return order;
    });
    return { success: true, order: result };
  } catch (error: any) {
    console.error(`[Client ${clientId}] Checkout failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  // Find the Ergonomic Mechanical Keyboard (which should have inventory: 1)
  const keyboard = await prisma.product.findFirst({
    where: { name: "Ergonomic Mechanical Keyboard" },
  });

  if (!keyboard) {
    console.error("Keyboard product not found in database. Please run seed first.");
    process.exit(1);
  }

  console.log(`Found Keyboard ID: ${keyboard.id}. Resetting inventory to 1...`);
  await prisma.product.update({
    where: { id: keyboard.id },
    data: { inventory: 1 },
  });

  // Delete existing orders to have a clean slate
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});

  console.log("Launching two concurrent checkouts for the same keyboard...");

  const startTime = Date.now();
  
  // Run two checkouts concurrently
  const [res1, res2] = await Promise.all([
    simulateCheckout("A", keyboard.id, 1),
    simulateCheckout("B", keyboard.id, 1),
  ]);

  const duration = Date.now() - startTime;
  console.log(`\nBoth checkout requests finished in ${duration}ms.`);

  console.log("\nResults:");
  console.log(`Client A: ${res1.success ? "SUCCESS" : "FAILED (" + res1.error + ")"}`);
  console.log(`Client B: ${res2.success ? "SUCCESS" : "FAILED (" + res2.error + ")"}`);

  // Assertions
  const successCount = [res1, res2].filter((r) => r.success).length;
  const failureCount = [res1, res2].filter((r) => !r.success).length;

  console.log(`\nSuccess count: ${successCount} (Expected: 1)`);
  console.log(`Failure count: ${failureCount} (Expected: 1)`);

  const updatedKeyboard = await prisma.product.findUnique({
    where: { id: keyboard.id },
  });
  console.log(`Updated inventory: ${updatedKeyboard?.inventory} (Expected: 0)`);

  const orderCount = await prisma.order.count();
  console.log(`Total orders in database: ${orderCount} (Expected: 1)`);

  if (successCount === 1 && failureCount === 1 && updatedKeyboard?.inventory === 0 && orderCount === 1) {
    console.log("\n? CONCURRENCY TEST PASSED PERFECTLY!");
  } else {
    console.error("\n? CONCURRENCY TEST FAILED!");
    process.exit(1);
  }

  await prisma.$disconnect();
}

main();
