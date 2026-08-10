import type { DbSeedFn } from "wasp/server";

export const devSeed: DbSeedFn = async (prisma) => {
  // Create products
  const headphones = await prisma.product.create({
    data: {
      name: "Premium Wireless Headphones",
      price: 100.0,
      inventory: 10,
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      name: "Ergonomic Mechanical Keyboard",
      price: 150.0,
      inventory: 1,
    },
  });

  // Create coupons
  await prisma.coupon.create({
    data: {
      code: "SAVE20",
      discountType: "PERCENTAGE",
      discountValue: 20.0,
    },
  });

  await prisma.coupon.create({
    data: {
      code: "FLAT50",
      discountType: "FLAT",
      discountValue: 50.0,
    },
  });

  console.log("Seed data created successfully");
  console.log("Products:", { headphones, keyboard });
};
