import type { Product } from "@prisma/client";

interface GetProductsWithFiltersInput {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "price_asc" | "price_desc" | "rating_desc" | "createdAt_desc";
  limit?: number;
  cursor?: number;
}

interface GetProductsWithFiltersOutput {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: { name: string; count: number }[];
    brands: { name: string; count: number }[];
  };
}

export async function getProductsWithFilters(
  args: GetProductsWithFiltersInput,
  context: any
): Promise<GetProductsWithFiltersOutput> {
  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    sortBy,
    limit,
    cursor,
  } = args;

  if (!context.entities || !context.entities.Product) {
    throw new Error("Product entity is not available in context.");
  }

  const ProductModel = context.entities.Product;

  // Construct where clause
  const where: any = {};

  if (category && category !== "All") {
    where.category = category;
  }
  if (brand && brand !== "All") {
    where.brand = brand;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) {
      where.price.gte = minPrice;
    }
    if (maxPrice !== undefined) {
      where.price.lte = maxPrice;
    }
  }

  if (inStock === true) {
    where.inStock = true;
  }

  if (search && search.trim() !== "") {
    // Format search query for PostgreSQL full-text search
    const formattedSearch = search
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => term.replace(/[^a-zA-Z0-9]/g, "")) // sanitize
      .filter(Boolean)
      .join(" & ");

    if (formattedSearch) {
      where.OR = [
        { name: { search: formattedSearch } },
        { description: { search: formattedSearch } },
      ];
    }
  }

  // Construct orderBy clause
  let orderBy: any[] = [{ id: "asc" }];
  if (sortBy === "price_asc") {
    orderBy = [{ price: "asc" }, { id: "asc" }];
  } else if (sortBy === "price_desc") {
    orderBy = [{ price: "desc" }, { id: "asc" }];
  } else if (sortBy === "rating_desc") {
    orderBy = [{ rating: "desc" }, { id: "asc" }];
  } else if (sortBy === "createdAt_desc") {
    orderBy = [{ createdAt: "desc" }, { id: "asc" }];
  }

  const limitVal = limit ?? 10;

  let products: Product[] = [];
  try {
    products = await ProductModel.findMany({
      where,
      take: limitVal + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      orderBy,
    });
  } catch (err) {
    // If PostgreSQL full-text search fails (e.g., due to invalid query format),
    // fallback to a standard contains search
    console.warn("Full-text search failed, falling back to contains search:", err);
    if (search && search.trim() !== "") {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    products = await ProductModel.findMany({
      where,
      take: limitVal + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      orderBy,
    });
  }

  let nextCursor: number | null = null;
  if (products.length > limitVal) {
    products.pop();
    nextCursor = products[products.length - 1].id;
  }

  // Aggregate facet counts dynamically based on the current filtered set (including search and filters)
  let categoryGroups: any[] = [];
  let brandGroups: any[] = [];

  try {
    categoryGroups = await ProductModel.groupBy({
      by: ["category"],
      where,
      _count: {
        _all: true,
      },
    });

    brandGroups = await ProductModel.groupBy({
      by: ["brand"],
      where,
      _count: {
        _all: true,
      },
    });
  } catch (err) {
    console.warn("GroupBy failed, falling back to manual aggregation:", err);
    // In case groupBy is not supported or fails on fallback search
    const allMatchingProducts = await ProductModel.findMany({ where });
    const catMap: Record<string, number> = {};
    const brandMap: Record<string, number> = {};
    for (const p of allMatchingProducts) {
      catMap[p.category] = (catMap[p.category] || 0) + 1;
      brandMap[p.brand] = (brandMap[p.brand] || 0) + 1;
    }
    categoryGroups = Object.entries(catMap).map(([category, count]) => ({
      category,
      _count: { _all: count },
    }));
    brandGroups = Object.entries(brandMap).map(([brand, count]) => ({
      brand,
      _count: { _all: count },
    }));
  }

  const categories = categoryGroups.map((g: any) => ({
    name: g.category,
    count: g._count._all,
  }));

  const brands = brandGroups.map((g: any) => ({
    name: g.brand,
    count: g._count._all,
  }));

  // Sort facets alphabetically by name
  categories.sort((a, b) => a.name.localeCompare(b.name));
  brands.sort((a, b) => a.name.localeCompare(b.name));

  return {
    products,
    nextCursor,
    facets: {
      categories,
      brands,
    },
  };
}
