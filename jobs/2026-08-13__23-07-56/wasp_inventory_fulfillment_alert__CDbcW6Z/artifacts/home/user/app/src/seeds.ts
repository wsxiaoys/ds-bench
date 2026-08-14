import { type DbSeedFn } from "wasp/server";
import { createProviderId, createUser, sanitizeAndSerializeProviderData } from "wasp/server/auth";
import { hashPassword } from "wasp/auth/password";

export const seedData: DbSeedFn = async (prisma) => {
  // 1. Create test user
  const username = "warehouse_manager";
  const password = "password123";

  // Check if user already exists to avoid duplicate seed issues
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (!existingUser) {
    const hashedPassword = await hashPassword(password);
    const providerId = createProviderId("username", username);
    const providerData = await sanitizeAndSerializeProviderData<"username">({
      hashedPassword: password, // Note: sanitizeAndSerializeProviderData expects the unhashed password and will hash it
    });

    await createUser(providerId, providerData, {
      username,
      password: hashedPassword,
    });
  }

  // Seed Suppliers
  const suppliers = [
    { id: 1, name: "Global Tech Distributors", email: "supply@globaltech.com" },
    { id: 2, name: "Apex Logistics", email: "orders@apexlogistics.com" },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }

  // Seed Products
  const products = [
    {
      id: 1,
      sku: "PROD-001",
      name: "Wireless Mouse",
      stock: 15,
      lowStockThreshold: 10,
      reorderQuantity: 50,
      supplierId: 1,
    },
    {
      id: 2,
      sku: "PROD-002",
      name: "Mechanical Keyboard",
      stock: 8,
      lowStockThreshold: 5,
      reorderQuantity: 20,
      supplierId: 2,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });
  }

  // Seed Customer Orders
  const orders = [
    {
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
    {
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
  ];

  for (const o of orders) {
    // Check if order already exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: o.id },
    });

    if (!existingOrder) {
      await prisma.order.create({
        data: o,
      });
    }
  }
};
