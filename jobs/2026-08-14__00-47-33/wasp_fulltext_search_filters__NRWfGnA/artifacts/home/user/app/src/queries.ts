import { Product } from '@prisma/client';

export type GetProductsInput = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc';
  limit?: number;
  cursor?: number;
};

export type GetProductsOutput = {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: { name: string; count: number }[];
    brands: { name: string; count: number }[];
  };
};

export const getProductsWithFilters = async (
  args: GetProductsInput,
  context: any
): Promise<GetProductsOutput> => {
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

  const baseFilter: any = {};
  if (category) {
    baseFilter.category = category;
  }
  if (brand) {
    baseFilter.brand = brand;
  }
  if (minPrice !== undefined) {
    baseFilter.price = { ...baseFilter.price, gte: minPrice };
  }
  if (maxPrice !== undefined) {
    baseFilter.price = { ...baseFilter.price, lte: maxPrice };
  }
  if (inStock === true) {
    baseFilter.inStock = true;
  }

  const searchQuery = search?.trim();
  
  // Define orderBy
  let orderByClause: any = [{ id: 'asc' }];
  if (sortBy === 'price_asc') {
    orderByClause = [{ price: 'asc' }, { id: 'asc' }];
  } else if (sortBy === 'price_desc') {
    orderByClause = [{ price: 'desc' }, { id: 'asc' }];
  } else if (sortBy === 'rating_desc') {
    orderByClause = [{ rating: 'desc' }, { id: 'asc' }];
  } else if (sortBy === 'createdAt_desc') {
    orderByClause = [{ createdAt: 'desc' }, { id: 'asc' }];
  }

  // We will try running with full-text search. If it fails, fallback to contains.
  const runQuery = async (useFullText: boolean) => {
    let searchFilter: any = {};
    if (searchQuery) {
      if (useFullText) {
        // Format for postgres full-text search
        const cleanSearch = searchQuery
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .join(' & ');
        if (cleanSearch) {
          searchFilter = {
            OR: [
              { name: { search: cleanSearch } },
              { description: { search: cleanSearch } },
            ],
          };
        }
      } else {
        // Fallback to contains
        searchFilter = {
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
          ],
        };
      }
    }

    const whereClause = {
      AND: [baseFilter, searchFilter],
    };

    const limitWithExtra = limit + 1;
    const products = await context.entities.Product.findMany({
      where: whereClause,
      take: limitWithExtra,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: orderByClause,
    });

    let nextCursor: number | null = null;
    const resultProducts = [...products];
    if (resultProducts.length > limit) {
      resultProducts.pop();
      nextCursor = resultProducts[resultProducts.length - 1].id;
    }

    // Dynamic Facets
    const categoryGroups = await context.entities.Product.groupBy({
      by: ['category'],
      where: whereClause,
      _count: {
        category: true,
      },
    });

    const brandGroups = await context.entities.Product.groupBy({
      by: ['brand'],
      where: whereClause,
      _count: {
        brand: true,
      },
    });

    const categories = categoryGroups.map((g: any) => ({
      name: g.category,
      count: g._count.category,
    }));

    const brands = brandGroups.map((g: any) => ({
      name: g.brand,
      count: g._count.brand,
    }));

    return {
      products: resultProducts,
      nextCursor,
      facets: {
        categories,
        brands,
      },
    };
  };

  try {
    return await runQuery(true);
  } catch (error) {
    console.error('Full-text search failed, falling back to contains-based search:', error);
    return await runQuery(false);
  }
};
