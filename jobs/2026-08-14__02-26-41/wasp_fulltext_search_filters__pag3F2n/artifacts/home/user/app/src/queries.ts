import { type Product } from "wasp/entities";

interface GetProductsInput {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc';
  limit?: number;
  cursor?: number;
}

interface FacetItem {
  name: string;
  count: number;
}

interface GetProductsOutput {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: FacetItem[];
    brands: FacetItem[];
  };
}

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
    limit,
    cursor,
  } = args;

  const limitVal = limit || 10;

  let orderBy: any = [];
  if (sortBy === 'price_asc') {
    orderBy = [{ price: 'asc' }, { id: 'asc' }];
  } else if (sortBy === 'price_desc') {
    orderBy = [{ price: 'desc' }, { id: 'asc' }];
  } else if (sortBy === 'rating_desc') {
    orderBy = [{ rating: 'desc' }, { id: 'asc' }];
  } else if (sortBy === 'createdAt_desc') {
    orderBy = [{ createdAt: 'desc' }, { id: 'asc' }];
  } else {
    orderBy = [{ id: 'asc' }];
  }

  const buildWhereClause = (strategy: 'postgres' | 'insensitive' | 'simple') => {
    const where: any = {};

    if (search && search.trim()) {
      if (strategy === 'postgres') {
        const cleanSearch = search.trim().replace(/[|&!*()<>:]/g, ' ').trim();
        const searchTerms = cleanSearch.split(/\s+/).filter(Boolean);
        if (searchTerms.length > 0) {
          const searchQuery = searchTerms.join(' & ');
          where.OR = [
            { name: { search: searchQuery } },
            { description: { search: searchQuery } }
          ];
        }
      } else if (strategy === 'insensitive') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      } else {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } }
        ];
      }
    }

    if (category && category !== 'All') {
      where.category = category;
    }
    if (brand && brand !== 'All') {
      where.brand = brand;
    }
    if (minPrice !== undefined && minPrice !== null) {
      where.price = { ...where.price, gte: minPrice };
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      where.price = { ...where.price, lte: maxPrice };
    }
    if (inStock === true) {
      where.inStock = true;
    }

    return where;
  };

  const strategies: ('postgres' | 'insensitive' | 'simple')[] = ['postgres', 'insensitive', 'simple'];

  for (const strategy of strategies) {
    try {
      const whereClause = buildWhereClause(strategy);

      const products = await context.entities.Product.findMany({
        where: whereClause,
        take: limitVal + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy,
      });

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

      const categories: FacetItem[] = categoryGroups.map((g: any) => ({
        name: g.category,
        count: g._count.category,
      }));

      const brands: FacetItem[] = brandGroups.map((g: any) => ({
        name: g.brand,
        count: g._count.brand,
      }));

      let nextCursor: number | null = null;
      if (products.length > limitVal) {
        const lastProduct = products[limitVal - 1];
        nextCursor = lastProduct.id;
        products.pop();
      }

      return {
        products,
        nextCursor,
        facets: {
          categories,
          brands,
        },
      };
    } catch (error) {
      console.warn(`Query strategy '${strategy}' failed:`, error);
      if (strategy === 'simple') {
        throw error;
      }
    }
  }

  throw new Error("Failed to execute query with any strategy");
};
