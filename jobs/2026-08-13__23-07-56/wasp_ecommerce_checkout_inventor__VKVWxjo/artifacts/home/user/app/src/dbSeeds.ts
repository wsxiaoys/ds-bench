export async function devSeed(prisma: any) {
  // Seed Products
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        { name: "Premium Wireless Headphones", price: 100.00, inventory: 10 },
        { name: "Ergonomic Mechanical Keyboard", price: 150.00, inventory: 1 }
      ]
    });
  }

  // Seed Coupons
  const couponCount = await prisma.coupon.count();
  if (couponCount === 0) {
    await prisma.coupon.createMany({
      data: [
        { code: "SAVE20", type: "PERCENTAGE", value: 20.0 },
        { code: "FLAT50", type: "FLAT", value: 50.0 }
      ]
    });
  }
}
