import { type PrismaClient } from '@prisma/client';

export async function seedDb(prisma: PrismaClient) {
  // Delete existing data to ensure a clean state
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.coupon.deleteMany({});

  // Seed Products
  await prisma.product.createMany({
    data: [
      {
        name: "Premium Wireless Headphones",
        price: 100.00,
        inventory: 10,
      },
      {
        name: "Ergonomic Mechanical Keyboard",
        price: 150.00,
        inventory: 1,
      },
    ],
  });

  // Seed Coupons
  await prisma.coupon.createMany({
    data: [
      {
        code: "SAVE20",
        type: "percentage",
        value: 20,
      },
      {
        code: "FLAT50",
        type: "flat",
        value: 50.00,
      },
    ],
  });

  console.log("Database seeded successfully!");
}
