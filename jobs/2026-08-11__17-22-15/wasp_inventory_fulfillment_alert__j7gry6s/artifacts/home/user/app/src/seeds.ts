import type { PrismaClient } from "@prisma/client";

export const seedData = async (prisma: PrismaClient) => {
  // Clear any existing records to avoid conflicts
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create User
  await prisma.user.create({
    data: {
      username: "warehouse_manager",
      password: "password123",
    },
  });

  // 2. Create Suppliers
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

  // 3. Create Products
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

  // 4. Create Customer Orders
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
};
