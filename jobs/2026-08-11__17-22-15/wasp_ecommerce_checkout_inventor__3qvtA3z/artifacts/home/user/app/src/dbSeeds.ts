export async function devSeed(prismaClient: any) {
  // Delete existing data to ensure the seed is idempotent
  await prismaClient.orderItem.deleteMany({});
  await prismaClient.order.deleteMany({});
  await prismaClient.product.deleteMany({});
  await prismaClient.coupon.deleteMany({});

  // Seed products
  await prismaClient.product.createMany({
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

  // Seed coupons
  await prismaClient.coupon.createMany({
    data: [
      {
        code: "SAVE20",
        type: "PERCENT",
        value: 20.0,
      },
      {
        code: "FLAT50",
        type: "FLAT",
        value: 50.0,
      },
    ],
  });

  console.log("Database seeded successfully!");
}
