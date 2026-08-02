import { type PrismaClient } from '@prisma/client';

export const seedDev = async (prisma: PrismaClient) => {
  // Seed Products
  await prisma.product.upsert({
    where: { id: 1 },
    update: {
      name: "Premium Wireless Headphones",
      price: 100.00,
      inventory: 10,
    },
    create: {
      id: 1,
      name: "Premium Wireless Headphones",
      price: 100.00,
      inventory: 10,
    },
  });

  await prisma.product.upsert({
    where: { id: 2 },
    update: {
      name: "Ergonomic Mechanical Keyboard",
      price: 150.00,
      inventory: 1,
    },
    create: {
      id: 2,
      name: "Ergonomic Mechanical Keyboard",
      price: 150.00,
      inventory: 1,
    },
  });

  // Seed Coupons
  await prisma.coupon.upsert({
    where: { code: "SAVE20" },
    update: {
      type: "PERCENT",
      value: 20.00,
    },
    create: {
      code: "SAVE20",
      type: "PERCENT",
      value: 20.00,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "FLAT50" },
    update: {
      type: "FLAT",
      value: 50.00,
    },
    create: {
      code: "FLAT50",
      type: "FLAT",
      value: 50.00,
    },
  });

  console.log("Database seeded successfully!");
};
