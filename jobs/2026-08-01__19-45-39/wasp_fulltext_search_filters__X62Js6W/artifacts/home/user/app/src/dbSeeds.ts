import type { DbSeedFn } from "wasp/server";

const products = [
  {
    name: "SuperFast Wireless Charger",
    description:
      "A high-speed wireless charging pad for all Qi-enabled smartphones and devices.",
    category: "Electronics",
    brand: "VoltCharge",
    price: 29.99,
    rating: 4.5,
    inStock: true,
  },
  {
    name: "UltraQuiet Blending Machine",
    description:
      "Professional grade blender with sound dampening shield and 1200W motor.",
    category: "Home & Kitchen",
    brand: "NutriBlend",
    price: 89.99,
    rating: 4.8,
    inStock: true,
  },
  {
    name: "Ergonomic Office Desk Chair",
    description:
      "High-back mesh chair with adjustable lumbar support and 3D armrests.",
    category: "Furniture",
    brand: "ErgoComfort",
    price: 149.99,
    rating: 4.2,
    inStock: false,
  },
  {
    name: "VoltCharge Portable Power Bank",
    description:
      "Compact 20000mAh external battery pack with dual USB-C fast charging.",
    category: "Electronics",
    brand: "VoltCharge",
    price: 39.99,
    rating: 4.6,
    inStock: true,
  },
  {
    name: "NutriBlend Compact Juicer",
    description:
      "Centrifugal juicing machine with wide feed chute, easy to clean.",
    category: "Home & Kitchen",
    brand: "NutriBlend",
    price: 49.99,
    rating: 4.0,
    inStock: true,
  },
  {
    name: "Leather Executive Swivel Chair",
    description:
      "Premium genuine leather office chair with padded armrests and tilt lock.",
    category: "Furniture",
    brand: "ErgoComfort",
    price: 249.99,
    rating: 4.7,
    inStock: true,
  },
];

export const seedProducts: DbSeedFn = async (prisma) => {
  const existingCount = await prisma.product.count();
  if (existingCount > 0) {
    console.log(
      `Skipping seeding: ${existingCount} product(s) already exist.`
    );
    return;
  }

  await prisma.product.createMany({
    data: products,
  });

  console.log(`Seeded ${products.length} products.`);
};
