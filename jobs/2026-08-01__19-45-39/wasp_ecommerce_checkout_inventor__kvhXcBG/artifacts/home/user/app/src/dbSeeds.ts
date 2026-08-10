import type { DbSeedFn } from "wasp/server";

export const devSeed: DbSeedFn = async (prisma) => {
  await prisma.product.createMany({
    data: [
      {
        name: "Premium Wireless Headphones",
        price: 100.0,
        inventory: 10,
      },
      {
        name: "Ergonomic Mechanical Keyboard",
        price: 150.0,
        inventory: 1,
      },
    ],
  });

  await prisma.coupon.createMany({
    data: [
      {
        code: "SAVE20",
        type: "PERCENTAGE",
        value: 20,
      },
      {
        code: "FLAT50",
        type: "FLAT",
        value: 50.0,
      },
    ],
  });
};
