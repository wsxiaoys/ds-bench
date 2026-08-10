import { hashPassword } from "wasp/auth/password";

export async function seedData(prisma: any) {
  // 1. Create or upsert the user
  const username = "warehouse_manager";
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (!existingUser) {
    const hashedPassword = await hashPassword("password123");
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
  }

  // 2. Seed Suppliers
  const suppliers = [
    { id: 1, name: "Global Tech Distributors", email: "supply@globaltech.com" },
    { id: 2, name: "Apex Logistics", email: "orders@apexlogistics.com" },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: {
        name: supplier.name,
        email: supplier.email,
      },
      create: supplier,
    });
  }

  // 3. Seed Products
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

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        reorderQuantity: product.reorderQuantity,
        supplierId: product.supplierId,
      },
      create: product,
    });
  }

  // 4. Seed Orders
  const order1 = await prisma.order.findUnique({ where: { id: 1 } });
  if (!order1) {
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
  }

  const order2 = await prisma.order.findUnique({ where: { id: 2 } });
  if (!order2) {
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
  }
}
