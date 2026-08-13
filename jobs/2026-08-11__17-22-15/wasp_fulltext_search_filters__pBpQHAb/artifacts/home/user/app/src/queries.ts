import type { Product } from "wasp/entities";
import type { GetProductsWithFilters } from "wasp/server/operations";

interface QueryInput {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc';
  limit?: number;
  cursor?: number;
  [key: string]: any;
}

interface QueryOutput {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: { name: string; count: number }[];
    brands: { name: string; count: number }[];
  };
  [key: string]: any;
}

export const getProductsWithFilters: GetProductsWithFilters<QueryInput, QueryOutput> = async (
  args,
  context
) => {
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
  } = args || {};

  const where: any = {};

  // Exact matches
  if (category && category !== "All") {
    where.category = category;
  }
  if (brand && brand !== "All") {
    where.brand = brand;
  }
  if (inStock) {
    where.inStock = true;
  }

  // Price range filters
  if (minPrice !== undefined && minPrice !== null && !isNaN(minPrice)) {
    where.price = { ...where.price, gte: minPrice };
  }
  if (maxPrice !== undefined && maxPrice !== null && !isNaN(maxPrice)) {
    where.price = { ...where.price, lte: maxPrice };
  }

  // PostgreSQL full-text search across name and description
  // Sanitize search term to only keep alphanumeric characters and spaces to prevent tsquery syntax errors
  const sanitizedSearch = search
    ? search.trim().replace(/[^a-zA-Z0-9\s]/g, '')
    : '';

  const formattedSearch = sanitizedSearch
    ? sanitizedSearch.split(/\s+/).filter(Boolean).map(word => `${word}:*`).join(' & ')
    : undefined;

  if (formattedSearch) {
    where.OR = [
      {
        name: {
          search: formattedSearch,
        },
      },
      {
        description: {
          search: formattedSearch,
        },
      },
    ];
  }

  // Determine sorting
  let orderBy: any = { id: 'asc' }; // fallback default
  if (sortBy === 'price_asc') {
    orderBy = { price: 'asc' };
  } else if (sortBy === 'price_desc') {
    orderBy = { price: 'desc' };
  } else if (sortBy === 'rating_desc') {
    orderBy = { rating: 'desc' };
  } else if (sortBy === 'createdAt_desc') {
    orderBy = { createdAt: 'desc' };
  }

  // Calculate facets dynamically over the entire filtered set (ignoring cursor and limit)
  const allMatching = await context.entities.Product.findMany({
    where,
    select: {
      category: true,
      brand: true,
    },
  });

  const categoryCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};

  for (const product of allMatching) {
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    brandCounts[product.brand] = (brandCounts[product.brand] || 0) + 1;
  }

  const facets = {
    categories: Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      count,
    })),
    brands: Object.entries(brandCounts).map(([name, count]) => ({
      name,
      count,
    })),
  };

  // Pagination limit
  const limitVal = limit || 10;

  // Fetch paginated products
  const products = await context.entities.Product.findMany({
    where,
    orderBy,
    take: limitVal + 1, // Fetch one extra to determine if there is a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: number | null = null;
  if (products.length > limitVal) {
    const nextProduct = products[products.length - 1];
    nextCursor = nextProduct.id;
    products.pop(); // Remove the extra item
  }

  return {
    products,
    nextCursor,
    facets,
  };
};
