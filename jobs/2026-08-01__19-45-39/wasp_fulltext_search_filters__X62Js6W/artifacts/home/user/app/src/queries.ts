import type { Prisma } from "@prisma/client";
import type { Product } from "wasp/entities";
import type { GetProductsWithFilters } from "wasp/server/operations";

export type SortBy =
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "createdAt_desc";

export type GetProductsWithFiltersInput = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: SortBy;
  limit?: number;
  cursor?: number;
};

export type FacetItem = {
  name: string;
  count: number;
};

export type GetProductsWithFiltersOutput = {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: FacetItem[];
    brands: FacetItem[];
  };
};

/**
 * Turns free-form user input into a PostgreSQL `tsquery`-compatible
 * string that can be used with Prisma's `search` filter. Each "word"
 * the user types is combined with the `&` (AND) operator so that all
 * of the given terms must match.
 */
function toTsQuery(rawSearch: string): string | null {
  const terms = rawSearch
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    // Strip characters that have special meaning in tsquery syntax so we
    // don't accidentally build an invalid query (e.g. "&", "|", "!", "(", ")", ":").
    .map((term) => term.replace(/[&|!():*<>]/g, ""))
    .filter(Boolean);

  if (terms.length === 0) {
    return null;
  }

  return terms.join(" & ");
}

function buildWhereClause(
  args: GetProductsWithFiltersInput,
  searchFilter: Prisma.ProductWhereInput | null
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (searchFilter) {
    and.push(searchFilter);
  }

  if (args.category) {
    and.push({ category: args.category });
  }

  if (args.brand) {
    and.push({ brand: args.brand });
  }

  if (args.inStock) {
    and.push({ inStock: true });
  }

  if (args.minPrice !== undefined || args.maxPrice !== undefined) {
    and.push({
      price: {
        ...(args.minPrice !== undefined ? { gte: args.minPrice } : {}),
        ...(args.maxPrice !== undefined ? { lte: args.maxPrice } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function getOrderBy(
  sortBy: SortBy | undefined
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sortBy) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "rating_desc":
      return [{ rating: "desc" }, { id: "asc" }];
    case "createdAt_desc":
      return [{ createdAt: "desc" }, { id: "asc" }];
    default:
      return [{ id: "asc" }];
  }
}

export const getProductsWithFilters: GetProductsWithFilters<
  GetProductsWithFiltersInput,
  GetProductsWithFiltersOutput
> = async (args, context) => {
  const limit = args.limit && args.limit > 0 ? args.limit : 10;
  const orderBy = getOrderBy(args.sortBy);

  const rawSearch = args.search?.trim();
  let searchFilter: Prisma.ProductWhereInput | null = null;
  if (rawSearch) {
    const tsQuery = toTsQuery(rawSearch);
    if (tsQuery) {
      searchFilter = {
        OR: [{ name: { search: tsQuery } }, { description: { search: tsQuery } }],
      };
    }
  }

  const findProducts = (where: Prisma.ProductWhereInput) =>
    context.entities.Product.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(args.cursor
        ? { cursor: { id: args.cursor }, skip: 1 }
        : {}),
    });

  let whereClause = buildWhereClause(args, searchFilter);
  let products: Product[];
  try {
    products = await findProducts(whereClause);
  } catch (error) {
    // Fall back gracefully if the full-text search query was invalid
    // (e.g. malformed tsquery syntax) by using a simple substring match
    // across name and description instead.
    if (rawSearch) {
      const fallbackSearchFilter: Prisma.ProductWhereInput = {
        OR: [
          { name: { contains: rawSearch, mode: "insensitive" } },
          { description: { contains: rawSearch, mode: "insensitive" } },
        ],
      };
      whereClause = buildWhereClause(args, fallbackSearchFilter);
      products = await findProducts(whereClause);
    } else {
      throw error;
    }
  }

  let nextCursor: number | null = null;
  if (products.length > limit) {
    products = products.slice(0, limit);
    nextCursor = products[products.length - 1].id;
  }

  const [categoryGroups, brandGroups] = await Promise.all([
    context.entities.Product.groupBy({
      by: ["category"],
      where: whereClause,
      _count: { _all: true },
    }),
    context.entities.Product.groupBy({
      by: ["brand"],
      where: whereClause,
      _count: { _all: true },
    }),
  ]);

  const categories: FacetItem[] = categoryGroups
    .map((group) => ({ name: group.category, count: group._count._all }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const brands: FacetItem[] = brandGroups
    .map((group) => ({ name: group.brand, count: group._count._all }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    products,
    nextCursor,
    facets: {
      categories,
      brands,
    },
  };
};
