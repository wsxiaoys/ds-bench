export const devSeed = async (prismaClient: any) => {
  // Clear existing if any
  await prismaClient.orderItem.deleteMany({});
  await prismaClient.order.deleteMany({});
  await prismaClient.product.deleteMany({});
  await prismaClient.coupon.deleteMany({});

  // Seed Products
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

  // Seed Coupons
  await prismaClient.coupon.createMany({
    data: [
      {
        code: "SAVE20",
        type: "PERCENT",
        value: 20.00,
      },
      {
        code: "FLAT50",
        type: "FLAT",
        value: 50.00,
      },
    ],
  });

  console.log("Database seeded successfully!");
};
