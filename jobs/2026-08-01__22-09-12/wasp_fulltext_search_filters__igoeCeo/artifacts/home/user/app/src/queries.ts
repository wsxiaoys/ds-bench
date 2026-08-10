import type { GetProductsWithFilters } from "wasp/server/operations/queries/types";
import type { Product } from "wasp/entities";

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

interface FacetItem {
  name: string;
  count: number;
}

interface GetProductsWithFiltersOutput {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: FacetItem[];
    brands: FacetItem[];
  };
}

export const getProductsWithFilters: GetProductsWithFilters<
  GetProductsWithFiltersInput,
  GetProductsWithFiltersOutput
> = async (args, context) => {
  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    sortBy = "createdAt_desc",
    limit = 10,
    cursor,
  } = args;

  const prisma = context.entities.Product;

  // Build the WHERE conditions
  const conditions: Record<string, unknown>[] = [];

  // Full-text search
  if (search && search.trim().length > 0) {
    const searchTerms = search
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `${t}:*`)
      .join(" & ");
    if (searchTerms.length > 0) {
      conditions.push({
        OR: [
          { name: { search: searchTerms } },
          { description: { search: searchTerms } },
        ],
      });
    }
  }

  // Category filter
  if (category) {
    conditions.push({ category: { equals: category } });
  }

  // Brand filter
  if (brand) {
    conditions.push({ brand: { equals: brand } });
  }

  // Price range
  if (minPrice !== undefined) {
    conditions.push({ price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    conditions.push({ price: { lte: maxPrice } });
  }

  // Stock filter
  if (inStock !== undefined) {
    conditions.push({ inStock: { equals: inStock } });
  }

  // Cursor pagination
  if (cursor) {
    conditions.push({ id: { gt: cursor } });
  }

  const where =
    conditions.length > 0 ? { AND: conditions } : {};

  // Determine sort order
  let orderBy: Record<string, string> = {};
  switch (sortBy) {
    case "price_asc":
      orderBy = { price: "asc" };
      break;
    case "price_desc":
      orderBy = { price: "desc" };
      break;
    case "rating_desc":
      orderBy = { rating: "desc" };
      break;
    case "createdAt_desc":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  // Fetch products (one extra to determine if there are more)
  const products = await prisma.findMany({
    where: where as any,
    orderBy: orderBy as any,
    take: limit + 1,
  });

  const hasMore = products.length > limit;
  const resultProducts = hasMore ? products.slice(0, limit) : products;
  const nextCursor = hasMore ? resultProducts[resultProducts.length - 1].id : null;

  // Build WHERE for facets (same filters as products, but WITHOUT cursor)
  const facetConditions: Record<string, unknown>[] = [];

  if (search && search.trim().length > 0) {
    const searchTerms = search
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `${t}:*`)
      .join(" & ");
    if (searchTerms.length > 0) {
      facetConditions.push({
        OR: [
          { name: { search: searchTerms } },
          { description: { search: searchTerms } },
        ],
      });
    }
  }

  if (category) {
    facetConditions.push({ category: { equals: category } });
  }

  if (brand) {
    facetConditions.push({ brand: { equals: brand } });
  }

  if (minPrice !== undefined) {
    facetConditions.push({ price: { gte: minPrice } });
  }
  if (maxPrice !== undefined) {
    facetConditions.push({ price: { lte: maxPrice } });
  }

  if (inStock !== undefined) {
    facetConditions.push({ inStock: { equals: inStock } });
  }

  const facetWhere =
    facetConditions.length > 0 ? { AND: facetConditions } : {};

  // Get category facet counts
  const categoryFacets = await prisma.groupBy({
    by: ["category"],
    where: facetWhere as any,
    _count: { category: true },
  });

  // Get brand facet counts
  const brandFacets = await prisma.groupBy({
    by: ["brand"],
    where: facetWhere as any,
    _count: { brand: true },
  });

  return {
    products: resultProducts,
    nextCursor,
    facets: {
      categories: categoryFacets.map((f) => ({
        name: f.category,
        count: f._count.category,
      })),
      brands: brandFacets.map((f) => ({
        name: f.brand,
        count: f._count.brand,
      })),
    },
  };
};
