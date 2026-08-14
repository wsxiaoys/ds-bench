import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
  // Clear existing data to ensure clean state
  await prisma.purchaseOrder.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.user.deleteMany({});

  // Seed the user:
  const providerId = createProviderId("username", "warehouse_manager");
  const providerData = await sanitizeAndSerializeProviderData({
    hashedPassword: "password123",
  });
  await createUser(providerId, providerData, {});

  // Seed exactly the following 2 Suppliers:
  await prisma.supplier.create({
    data: {
      id: 1,
      name: "Global Tech Distributors",
      email: "supply@globaltech.com",
    },
  });

  await prisma.supplier.create({
    data: {
      id: 2,
      name: "Apex Logistics",
      email: "orders@apexlogistics.com",
    },
  });

  // Seed exactly the following 2 Products:
  await prisma.product.create({
    data: {
      id: 1,
      sku: "PROD-001",
      name: "Wireless Mouse",
      stock: 15,
      lowStockThreshold: 10,
      reorderQuantity: 50,
      supplierId: 1,
    },
  });

  await prisma.product.create({
    data: {
      id: 2,
      sku: "PROD-002",
      name: "Mechanical Keyboard",
      stock: 8,
      lowStockThreshold: 5,
      reorderQuantity: 20,
      supplierId: 2,
    },
  });

  // Seed exactly the following 2 Customer Orders:
  // Order 1
  await prisma.order.create({
    data: {
      id: 1,
      customerName: "TechCorp Solutions",
      status: "PENDING",
      orderItems: {
        create: [
          { productId: 1, quantity: 8 },
          { productId: 2, quantity: 2 },
        ],
      },
    },
  });

  // Order 2
  await prisma.order.create({
    data: {
      id: 2,
      customerName: "RetailHub",
      status: "PENDING",
      orderItems: {
        create: [
          { productId: 1, quantity: 10 },
          { productId: 2, quantity: 2 },
        ],
      },
    },
  });

  console.log("Database seeded successfully!");
};
