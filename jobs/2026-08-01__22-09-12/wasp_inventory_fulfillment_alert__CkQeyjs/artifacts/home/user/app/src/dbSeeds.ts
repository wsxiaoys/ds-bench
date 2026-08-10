export const seedData = async (prisma: any) => {
  // Create test user
  await prisma.user.create({
    data: {
      username: "warehouse_manager",
      password: "password123",
    },
  });

  // Create Suppliers
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

  // Create Products
  await prisma.product.create({
    data: {
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
      sku: "PROD-002",
      name: "Mechanical Keyboard",
      stock: 8,
      lowStockThreshold: 5,
      reorderQuantity: 20,
      supplierId: 2,
    },
  });

  // Create Order 1
  await prisma.order.create({
    data: {
      customerName: "TechCorp Solutions",
      status: "PENDING",
      orderItems: {
        create: [
          {
            product: { connect: { sku: "PROD-001" } },
            quantity: 8,
          },
          {
            product: { connect: { sku: "PROD-002" } },
            quantity: 2,
          },
        ],
      },
    },
  });

  // Create Order 2
  await prisma.order.create({
    data: {
      customerName: "RetailHub",
      status: "PENDING",
      orderItems: {
        create: [
          {
            product: { connect: { sku: "PROD-001" } },
            quantity: 10,
          },
          {
            product: { connect: { sku: "PROD-002" } },
            quantity: 2,
          },
        ],
      },
    },
  });
};
