import type { DbSeedFn } from "wasp/server"

export const devSeed: DbSeedFn = async (prisma) => {
  // Clear existing records
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.coupon.deleteMany({});

  // Seed products
  await prisma.product.createMany({
    data: [
      { name: "Premium Wireless Headphones", price: 100.00, inventory: 10 },
      { name: "Ergonomic Mechanical Keyboard", price: 150.00, inventory: 1 },
    ],
  });

  // Seed coupons
  await prisma.coupon.createMany({
    data: [
      { code: "SAVE20", type: "PERCENTAGE", value: 20 },
      { code: "FLAT50", type: "FLAT", value: 50 },
    ],
  });

  console.log("Database seeded successfully!");
};
