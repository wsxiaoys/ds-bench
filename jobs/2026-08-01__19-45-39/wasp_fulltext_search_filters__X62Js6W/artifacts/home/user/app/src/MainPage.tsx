import { useCallback, useEffect, useState } from "react";
import { getProductsWithFilters } from "wasp/client/operations";
import type { Product } from "wasp/entities";
import "./Main.css";

type SortBy = "price_asc" | "price_desc" | "rating_desc" | "createdAt_desc";

type FacetItem = { name: string; count: number };

export function MainPage() {
  // Filter state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt_desc");

  // Result state
  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [categoryFacets, setCategoryFacets] = useState<FacetItem[]>([]);
  const [brandFacets, setBrandFacets] = useState<FacetItem[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildArgs = useCallback(
    (cursor?: number) => ({
      search: search.trim() || undefined,
      category: category || undefined,
      brand: brand || undefined,
      minPrice: minPrice !== "" ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
      inStock: inStock || undefined,
      sortBy,
      limit: 10,
      cursor,
    }),
    [search, category, brand, minPrice, maxPrice, inStock, sortBy]
  );

  const fetchProducts = useCallback(
    async (cursor: number | undefined, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getProductsWithFilters(buildArgs(cursor));
        setProducts((prev) =>
          append ? [...prev, ...result.products] : result.products
        );
        setNextCursor(result.nextCursor);
        setCategoryFacets(result.facets.categories);
        setBrandFacets(result.facets.brands);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load products."
        );
      } finally {
        setLoading(false);
      }
    },
    [buildArgs]
  );

  // Fetch the full, unfiltered list of categories/brands once on mount so the
  // filter dropdowns always offer every possible option.
  useEffect(() => {
    (async () => {
      try {
        const result = await getProductsWithFilters({ limit: 1 });
        setAllCategories(result.facets.categories.map((c) => c.name));
        setAllBrands(result.facets.brands.map((b) => b.name));
      } catch {
        // Ignore - dropdowns will just be empty besides "All".
      }
    })();
  }, []);

  // Whenever any filter/sort option changes, reset to the first page.
  useEffect(() => {
    fetchProducts(undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, brand, minPrice, maxPrice, inStock, sortBy]);

  const handleLoadMore = () => {
    if (nextCursor !== null) {
      fetchProducts(nextCursor, true);
    }
  };

  return (
    <main className="catalog-container">
      <h1 className="catalog-title">Product Catalog</h1>

      <div className="filters">
        <input
          data-testid="search-input"
          className="search-input"
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          data-testid="category-filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          data-testid="brand-filter"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">All Brands</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <input
          data-testid="min-price-input"
          className="price-input"
          type="number"
          placeholder="Min Price"
          value={minPrice}
          min={0}
          onChange={(e) => setMinPrice(e.target.value)}
        />

        <input
          data-testid="max-price-input"
          className="price-input"
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          min={0}
          onChange={(e) => setMaxPrice(e.target.value)}
        />

        <label className="instock-label">
          <input
            data-testid="instock-checkbox"
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
          />
          In Stock Only
        </label>

        <select
          data-testid="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="createdAt_desc">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="rating_desc">Highest Rated</option>
        </select>
      </div>

      <div className="catalog-content">
        <aside className="facets-panel">
          <h3>Categories</h3>
          <div data-testid="facet-categories">
            {categoryFacets.map((c) => (
              <div
                key={c.name}
                data-testid="facet-category-item"
                data-category-name={c.name}
                className="facet-item"
              >
                <span>{c.name}</span>
                <span className="facet-count">{c.count}</span>
              </div>
            ))}
          </div>

          <h3>Brands</h3>
          <div data-testid="facet-brands">
            {brandFacets.map((b) => (
              <div
                key={b.name}
                data-testid="facet-brand-item"
                data-brand-name={b.name}
                className="facet-item"
              >
                <span>{b.name}</span>
                <span className="facet-count">{b.count}</span>
              </div>
            ))}
          </div>
        </aside>

        <section>
          {error && <p className="error-state">{error}</p>}

          <div data-testid="product-list" className="product-list">
            {products.map((product) => (
              <div
                key={product.id}
                data-testid="product-item"
                data-product-id={product.id}
                className="product-card"
              >
                <h4 data-testid="product-name">{product.name}</h4>
                <p className="product-description">{product.description}</p>
                <div className="product-meta">
                  <span data-testid="product-price" className="product-price">
                    ${product.price.toFixed(2)}
                  </span>
                  <span data-testid="product-rating">
                    ⭐ {product.rating.toFixed(1)}
                  </span>
                </div>
                <div className="product-meta">
                  <span data-testid="product-category">
                    {product.category}
                  </span>
                  <span data-testid="product-brand">{product.brand}</span>
                </div>
                {!product.inStock && (
                  <span className="out-of-stock-badge">Out of Stock</span>
                )}
              </div>
            ))}
          </div>

          {products.length === 0 && !loading && !error && (
            <p className="empty-state">No products found.</p>
          )}

          {nextCursor !== null && (
            <div className="load-more-wrapper">
              <button
                data-testid="load-more-button"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
