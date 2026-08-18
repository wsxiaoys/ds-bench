import { PrismaClient } from '@prisma/client';
import { checkout } from './actions';

const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting concurrency test...");

  // Reset database state first
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.coupon.deleteMany({});

  // Insert a product with inventory 1
  const keyboard = await prisma.product.create({
    data: {
      name: "Ergonomic Mechanical Keyboard",
      price: 150.00,
      inventory: 1,
    },
  });

  console.log(`Created product: ${keyboard.name} with inventory: ${keyboard.inventory}`);

  const items = [{ productId: keyboard.id, quantity: 1 }];

  // Fire two concurrent checkout requests
  console.log("Firing 2 concurrent checkout requests...");
  const results = await Promise.allSettled([
    checkout({ items }, { entities: { Product: prisma.product, Coupon: prisma.coupon, Order: prisma.order, OrderItem: prisma.orderItem } }),
    checkout({ items }, { entities: { Product: prisma.product, Coupon: prisma.coupon, Order: prisma.order, OrderItem: prisma.orderItem } }),
  ]);

  let successCount = 0;
  let failureCount = 0;
  let failureReason = "";

  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      successCount++;
      console.log(`Request ${i + 1} succeeded:`, res.value);
    } else {
      failureCount++;
      failureReason = res.reason.message;
      console.log(`Request ${i + 1} failed with error:`, res.reason.message);
    }
  });

  // Verify inventory is 0
  const updatedKeyboard = await prisma.product.findUnique({
    where: { id: keyboard.id },
  });
  console.log(`Updated inventory: ${updatedKeyboard?.inventory}`);

  // Assertions
  if (successCount === 1 && failureCount === 1 && updatedKeyboard?.inventory === 0) {
    console.log("SUCCESS: Concurrency test passed perfectly!");
    console.log(`Failed request reason contains "Insufficient inventory": ${failureReason.includes("Insufficient inventory") || failureReason.includes("Out of stock")}`);
  } else {
    console.error("FAILURE: Concurrency test failed!");
    process.exit(1);
  }

  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
