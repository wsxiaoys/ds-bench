import { type GetProductsWithFilters } from "wasp/server/operations";
import { type Product } from "wasp/entities";

type GetProductsWithFiltersArgs = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "price_asc" | "price_desc" | "rating_desc" | "createdAt_desc";
  limit?: number;
  cursor?: number;
  [key: string]: any;
};

type GetProductsWithFiltersOutput = {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: { name: string; count: number }[];
    brands: { name: string; count: number }[];
  };
  [key: string]: any;
};

export const getProductsWithFilters: GetProductsWithFilters<
  GetProductsWithFiltersArgs,
  GetProductsWithFiltersOutput
> = async (args, context) => {
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

  const where: any = {};

  // Exact filters
  if (category && category !== "All") {
    where.category = category;
  }
  if (brand && brand !== "All") {
    where.brand = brand;
  }

  // Price filters
  if (minPrice !== undefined && !isNaN(minPrice)) {
    where.price = {
      ...(where.price || {}),
      gte: minPrice,
    };
  }
  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    where.price = {
      ...(where.price || {}),
      lte: maxPrice,
    };
  }

  // Stock filter: "If true, only return products where inStock is true"
  if (inStock === true) {
    where.inStock = true;
  }

  // Prepare full-text search
  let formattedSearch = "";
  if (search && search.trim()) {
    formattedSearch = search
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => `${word}:*`)
      .join(" & ");
  }

  let allMatchedProducts: Product[] = [];

  const orderBy: any[] = [];
  if (sortBy === "price_asc") {
    orderBy.push({ price: "asc" });
  } else if (sortBy === "price_desc") {
    orderBy.push({ price: "desc" });
  } else if (sortBy === "rating_desc") {
    orderBy.push({ rating: "desc" });
  } else if (sortBy === "createdAt_desc") {
    orderBy.push({ createdAt: "desc" });
  }
  orderBy.push({ id: "asc" }); // Tie-breaker

  // We try-catch the PostgreSQL full-text search. If it fails or is invalid, we fallback to a case-insensitive contains search or no search.
  try {
    const searchWhere = { ...where };
    if (formattedSearch) {
      searchWhere.OR = [
        { name: { search: formattedSearch } },
        { description: { search: formattedSearch } },
      ];
    }

    allMatchedProducts = await context.entities.Product.findMany({
      where: searchWhere,
      orderBy,
    });
  } catch (error) {
    console.warn("PostgreSQL full-text search failed or is unsupported in this context, falling back to contains search.", error);
    
    // Fallback search logic: case-insensitive contains search
    const fallbackWhere = { ...where };
    if (search && search.trim()) {
      fallbackWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    allMatchedProducts = await context.entities.Product.findMany({
      where: fallbackWhere,
      orderBy,
    });
  }

  // Calculate dynamic facet counts from all matched products
  const categoriesMap: Record<string, number> = {};
  const brandsMap: Record<string, number> = {};

  for (const p of allMatchedProducts) {
    categoriesMap[p.category] = (categoriesMap[p.category] || 0) + 1;
    brandsMap[p.brand] = (brandsMap[p.brand] || 0) + 1;
  }

  const categories = Object.entries(categoriesMap).map(([name, count]) => ({
    name,
    count,
  }));
  const brands = Object.entries(brandsMap).map(([name, count]) => ({
    name,
    count,
  }));

  categories.sort((a, b) => a.name.localeCompare(b.name));
  brands.sort((a, b) => a.name.localeCompare(b.name));

  // Cursor-based pagination in memory
  let startIndex = 0;
  if (cursor !== undefined) {
    const index = allMatchedProducts.findIndex(p => p.id === cursor);
    if (index !== -1) {
      startIndex = index + 1;
    }
  }

  const paginatedProducts = allMatchedProducts.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < allMatchedProducts.length;
  const nextCursor = hasMore && paginatedProducts.length > 0 
    ? paginatedProducts[paginatedProducts.length - 1].id 
    : null;

  return {
    products: paginatedProducts,
    nextCursor,
    facets: {
      categories,
      brands,
    },
  };
};
