export async function getProductsWithFilters(args: any, context: any) {
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

  const prisma = context.entities.Product;

  // 1. Build where clause
  const where: any = {};

  if (category && category !== "all" && category !== "All") {
    where.category = category;
  }

  if (brand && brand !== "all" && brand !== "All") {
    where.brand = brand;
  }

  if (typeof minPrice === "number") {
    where.price = { ...where.price, gte: minPrice };
  }

  if (typeof maxPrice === "number") {
    where.price = { ...where.price, lte: maxPrice };
  }

  if (inStock === true) {
    where.inStock = true;
  }

  // Handle full-text search
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    // Format for PostgreSQL full-text search (e.g. "word1 & word2")
    const formattedSearch = cleanSearch
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z0-9]/g, "")) // strip special characters to avoid syntax errors
      .filter(Boolean)
      .join(" & ");

    if (formattedSearch) {
      where.OR = [
        { name: { search: formattedSearch } },
        { description: { search: formattedSearch } },
      ];
    }
  }

  // 2. Build orderBy clause
  let orderBy: any = {};
  if (sortBy === "price_asc") {
    orderBy = { price: "asc" };
  } else if (sortBy === "price_desc") {
    orderBy = { price: "desc" };
  } else if (sortBy === "rating_desc") {
    orderBy = { rating: "desc" };
  } else if (sortBy === "createdAt_desc") {
    orderBy = { createdAt: "desc" };
  } else {
    orderBy = { id: "asc" };
  }

  // 3. Fetch products with limit + 1 for cursor-based pagination
  const limitNum = limit || 10;
  const queryOptions: any = {
    where,
    take: limitNum + 1,
    orderBy: [orderBy, { id: "asc" }],
  };

  if (cursor) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1;
  }

  let products = [];
  try {
    products = await prisma.findMany(queryOptions);
  } catch (error) {
    console.error("Prisma search failed, falling back to contains search", error);
    // Fallback to "contains" search if full-text search fails due to syntax or database reasons
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      where.OR = [
        { name: { contains: cleanSearch, mode: "insensitive" } },
        { description: { contains: cleanSearch, mode: "insensitive" } },
      ];
      queryOptions.where = where;
    }
    products = await prisma.findMany(queryOptions);
  }

  // 4. Determine nextCursor
  let nextCursor: number | null = null;
  if (products.length > limitNum) {
    const lastProduct = products[products.length - 2]; // since we fetched limitNum + 1, the last one is the extra
    nextCursor = lastProduct.id;
    products = products.slice(0, limitNum);
  }

  // 5. Calculate Facets
  // Group by category and brand matching the *current search query and all active filters*
  const allCategories = ["Electronics", "Home & Kitchen", "Furniture"];
  const allBrands = ["VoltCharge", "NutriBlend", "ErgoComfort"];

  let categoryGroups: any[] = [];
  let brandGroups: any[] = [];

  try {
    categoryGroups = await prisma.groupBy({
      by: ["category"],
      where,
      _count: {
        category: true,
      },
    });

    brandGroups = await prisma.groupBy({
      by: ["brand"],
      where,
      _count: {
        brand: true,
      },
    });
  } catch (error) {
    console.error("Facets calculation failed, falling back to manual grouping", error);
    // If full-text search is active and groupBy fails, we can query all matching products and group them in JS
    const allMatchingProducts = await prisma.findMany({ where });
    const catMap: Record<string, number> = {};
    const brMap: Record<string, number> = {};
    for (const p of allMatchingProducts) {
      catMap[p.category] = (catMap[p.category] || 0) + 1;
      brMap[p.brand] = (brMap[p.brand] || 0) + 1;
    }
    categoryGroups = Object.entries(catMap).map(([category, count]) => ({
      category,
      _count: { category: count },
    }));
    brandGroups = Object.entries(brMap).map(([brand, count]) => ({
      brand,
      _count: { brand: count },
    }));
  }

  const categoryMap: Record<string, number> = {};
  for (const cat of allCategories) {
    categoryMap[cat] = 0;
  }
  for (const g of categoryGroups) {
    categoryMap[g.category] = g._count.category;
  }
  const categories = Object.entries(categoryMap).map(([name, count]) => ({
    name,
    count,
  }));

  const brandMap: Record<string, number> = {};
  for (const b of allBrands) {
    brandMap[b] = 0;
  }
  for (const g of brandGroups) {
    brandMap[g.brand] = g._count.brand;
  }
  const brands = Object.entries(brandMap).map(([name, count]) => ({
    name,
    count,
  }));

  return {
    products,
    nextCursor,
    facets: {
      categories,
      brands,
    },
  };
}
