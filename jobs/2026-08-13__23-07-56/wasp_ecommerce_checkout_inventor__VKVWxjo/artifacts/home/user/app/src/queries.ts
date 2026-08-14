import { devSeed } from "./dbSeeds";

export const getProducts = async (args: any, context: any) => {
  const Product = context.entities.Product;
  
  const productCount = await Product.count();
  if (productCount === 0) {
    const prisma = context.prisma;
    if (prisma) {
      await devSeed(prisma);
    } else {
      // Fallback
      await Product.createMany({
        data: [
          { name: "Premium Wireless Headphones", price: 100.00, inventory: 10 },
          { name: "Ergonomic Mechanical Keyboard", price: 150.00, inventory: 1 }
        ]
      });
      if (context.entities.Coupon) {
        await context.entities.Coupon.createMany({
          data: [
            { code: "SAVE20", type: "PERCENTAGE", value: 20.0 },
            { code: "FLAT50", type: "FLAT", value: 50.0 }
          ]
        });
      }
    }
  }

  return Product.findMany({
    orderBy: { id: "asc" },
  });
};
