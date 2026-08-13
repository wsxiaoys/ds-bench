import { type GetProductsWithFilters } from "wasp/server/operations"
import { type Product } from "wasp/entities"

export const getProductsWithFilters: GetProductsWithFilters<
  {
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc';
    limit?: number;
    cursor?: number;
  },
  {
    products: Product[];
    nextCursor: number | null;
    facets: {
      categories: { name: string; count: number }[];
      brands: { name: string; count: number }[];
    };
  }
> = async (args, context) => {
  const prisma = context.entities.Product;

  // Auto-seed if database is empty
  const count = await prisma.count();
  if (count === 0) {
    const initialProducts = [
      {
        name: "SuperFast Wireless Charger",
        description: "A high-speed wireless charging pad for all Qi-enabled smartphones and devices.",
        category: "Electronics",
        brand: "VoltCharge",
        price: 29.99,
        rating: 4.5,
        inStock: true,
      },
      {
        name: "UltraQuiet Blending Machine",
        description: "Professional grade blender with sound dampening shield and 1200W motor.",
        category: "Home & Kitchen",
        brand: "NutriBlend",
        price: 89.99,
        rating: 4.8,
        inStock: true,
      },
      {
        name: "Ergonomic Office Desk Chair",
        description: "High-back mesh chair with adjustable lumbar support and 3D armrests.",
        category: "Furniture",
        brand: "ErgoComfort",
        price: 149.99,
        rating: 4.2,
        inStock: false,
      },
      {
        name: "VoltCharge Portable Power Bank",
        description: "Compact 20000mAh external battery pack with dual USB-C fast charging.",
        category: "Electronics",
        brand: "VoltCharge",
        price: 39.99,
        rating: 4.6,
        inStock: true,
      },
      {
        name: "NutriBlend Compact Juicer",
        description: "Centrifugal juicing machine with wide feed chute, easy to clean.",
        category: "Home & Kitchen",
        brand: "NutriBlend",
        price: 49.99,
        rating: 4.0,
        inStock: true,
      },
      {
        name: "Leather Executive Swivel Chair",
        description: "Premium genuine leather office chair with padded armrests and tilt lock.",
        category: "Furniture",
        brand: "ErgoComfort",
        price: 249.99,
        rating: 4.7,
        inStock: true,
      },
    ];

    for (const prod of initialProducts) {
      await prisma.create({ data: prod });
    }
  }

  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    sortBy,
    limit = 10,
    cursor,
  } = args;

  // Build filters (excluding search)
  const whereClauseWithoutSearch: any = {};

  if (category && category !== "All") {
    whereClauseWithoutSearch.category = category;
  }
  if (brand && brand !== "All") {
    whereClauseWithoutSearch.brand = brand;
  }

  if (minPrice !== undefined && minPrice !== null) {
    whereClauseWithoutSearch.price = { ...whereClauseWithoutSearch.price, gte: minPrice };
  }
  if (maxPrice !== undefined && maxPrice !== null) {
    whereClauseWithoutSearch.price = { ...whereClauseWithoutSearch.price, lte: maxPrice };
  }

  if (inStock === true) {
    whereClauseWithoutSearch.inStock = true;
  }

  const searchQuery = search?.trim();

  // 1. Calculate Facet Counts
  // Facets must dynamically reflect products matching the current search query and all active filters.
  const facetQueryOptions = {
    select: {
      category: true,
      brand: true,
    },
  };

  let facetResults: { category: string; brand: string }[] = [];
  if (!searchQuery) {
    facetResults = await prisma.findMany({
      where: whereClauseWithoutSearch,
      ...facetQueryOptions,
    });
  } else {
    try {
      // Try Full-Text Search
      facetResults = await prisma.findMany({
        where: {
          ...whereClauseWithoutSearch,
          OR: [
            { name: { search: searchQuery } },
            { description: { search: searchQuery } },
          ],
        },
        ...facetQueryOptions,
      });
    } catch (e) {
      // Fallback to contains
      facetResults = await prisma.findMany({
        where: {
          ...whereClauseWithoutSearch,
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { description: { contains: searchQuery, mode: "insensitive" } },
          ],
        },
        ...facetQueryOptions,
      });
    }
  }

  const categoryCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};

  for (const item of facetResults) {
    if (item.category) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }
    if (item.brand) {
      brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
    }
  }

  const categories = Object.entries(categoryCounts).map(([name, count]) => ({ name, count }));
  const brands = Object.entries(brandCounts).map(([name, count]) => ({ name, count }));

  categories.sort((a, b) => a.name.localeCompare(b.name));
  brands.sort((a, b) => a.name.localeCompare(b.name));

  // 2. Build OrderBy
  const orderBy: any[] = [];
  if (sortBy === "price_asc") {
    orderBy.push({ price: "asc" });
  } else if (sortBy === "price_desc") {
    orderBy.push({ price: "desc" });
  } else if (sortBy === "rating_desc") {
    orderBy.push({ rating: "desc" });
  } else if (sortBy === "createdAt_desc") {
    orderBy.push({ createdAt: "desc" });
  } else {
    orderBy.push({ id: "asc" });
  }
  // Secondary sort for stable cursor pagination
  orderBy.push({ id: "asc" });

  // 3. Query Products with Pagination
  const queryOptions: any = {
    orderBy,
    take: limit + 1, // Fetch limit + 1 to check if there is a next page
  };

  if (cursor !== undefined && cursor !== null) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1; // Skip the cursor element itself
  }

  let products: Product[] = [];
  if (!searchQuery) {
    products = await prisma.findMany({
      where: whereClauseWithoutSearch,
      ...queryOptions,
    });
  } else {
    try {
      products = await prisma.findMany({
        where: {
          ...whereClauseWithoutSearch,
          OR: [
            { name: { search: searchQuery } },
            { description: { search: searchQuery } },
          ],
        },
        ...queryOptions,
      });
    } catch (e) {
      products = await prisma.findMany({
        where: {
          ...whereClauseWithoutSearch,
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { description: { contains: searchQuery, mode: "insensitive" } },
          ],
        },
        ...queryOptions,
      });
    }
  }

  let nextCursor: number | null = null;
  if (products.length > limit) {
    products = products.slice(0, limit);
    nextCursor = products[products.length - 1].id;
  }

  return {
    products,
    nextCursor,
    facets: {
      categories,
      brands,
    },
  };
}
