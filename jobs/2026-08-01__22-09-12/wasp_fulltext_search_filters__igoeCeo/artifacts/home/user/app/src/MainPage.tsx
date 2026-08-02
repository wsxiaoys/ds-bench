import { useState, useEffect, useCallback } from "react";
import { useQuery, getProductsWithFilters } from "wasp/client/operations";
import type { Product } from "wasp/entities";
import "./Main.css";

interface FacetItem {
  name: string;
  count: number;
}

interface QueryResult {
  products: Product[];
  nextCursor: number | null;
  facets: {
    categories: FacetItem[];
    brands: FacetItem[];
  };
}

export function MainPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt_desc");

  // Accumulated products and cursor
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [facets, setFacets] = useState<{
    categories: FacetItem[];
    brands: FacetItem[];
  }>({ categories: [], brands: [] });

  const buildQueryArgs = useCallback(
    (cursor?: number | null) => {
      const args: Record<string, unknown> = {
        sortBy,
        limit: 10,
      };
      if (search.trim()) args.search = search.trim();
      if (category) args.category = category;
      if (brand) args.brand = brand;
      if (minPrice) args.minPrice = parseFloat(minPrice);
      if (maxPrice) args.maxPrice = parseFloat(maxPrice);
      if (inStock) args.inStock = true;
      if (cursor) args.cursor = cursor;
      return args;
    },
    [search, category, brand, minPrice, maxPrice, inStock, sortBy]
  );

  const { data, isLoading, error } = useQuery(
    getProductsWithFilters,
    buildQueryArgs(null),
    { enabled: true }
  );

  // Reset accumulated products when filters change
  useEffect(() => {
    setAllProducts([]);
    setNextCursor(null);
  }, [search, category, brand, minPrice, maxPrice, inStock, sortBy]);

  // Update products and facets when data arrives
  useEffect(() => {
    if (data) {
      setAllProducts(data.products);
      setNextCursor(data.nextCursor);
      setFacets(data.facets);
    }
  }, [data]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;

    const args = buildQueryArgs(nextCursor);
    try {
      const result = await getProductsWithFilters(args);
      setAllProducts((prev) => [...prev, ...result.products]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error("Failed to load more products:", err);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBrand(e.target.value);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinPrice(e.target.value);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxPrice(e.target.value);
  };

  const handleInStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInStock(e.target.checked);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };

  const handleCategoryFacetClick = (categoryName: string) => {
    setCategory(category === categoryName ? "" : categoryName);
  };

  const handleBrandFacetClick = (brandName: string) => {
    setBrand(brand === brandName ? "" : brandName);
  };

  return (
    <main className="catalog-container">
      <h1 className="catalog-title">Product Catalog</h1>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="search-input">Search</label>
            <input
              id="search-input"
              data-testid="search-input"
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              data-testid="category-filter"
              value={category}
              onChange={handleCategoryChange}
            >
              <option value="">All</option>
              <option value="Electronics">Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Furniture">Furniture</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="brand-filter">Brand</label>
            <select
              id="brand-filter"
              data-testid="brand-filter"
              value={brand}
              onChange={handleBrandChange}
            >
              <option value="">All</option>
              <option value="VoltCharge">VoltCharge</option>
              <option value="NutriBlend">NutriBlend</option>
              <option value="ErgoComfort">ErgoComfort</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="min-price-input">Min Price</label>
            <input
              id="min-price-input"
              data-testid="min-price-input"
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={handleMinPriceChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="max-price-input">Max Price</label>
            <input
              id="max-price-input"
              data-testid="max-price-input"
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={handleMaxPriceChange}
            />
          </div>

          <div className="filter-group checkbox-group">
            <label htmlFor="instock-checkbox">
              <input
                id="instock-checkbox"
                data-testid="instock-checkbox"
                type="checkbox"
                checked={inStock}
                onChange={handleInStockChange}
              />
              In Stock Only
            </label>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-select">Sort By</label>
            <select
              id="sort-select"
              data-testid="sort-select"
              value={sortBy}
              onChange={handleSortChange}
            >
              <option value="createdAt_desc">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Facets Section */}
      <div className="facets-section">
        <div className="facet-group">
          <h3>Categories</h3>
          <div data-testid="facet-categories">
            {facets.categories.map((f) => (
              <button
                key={f.name}
                data-testid="facet-category-item"
                data-category-name={f.name}
                className={`facet-item ${category === f.name ? "active" : ""}`}
                onClick={() => handleCategoryFacetClick(f.name)}
              >
                {f.name} ({f.count})
              </button>
            ))}
          </div>
        </div>

        <div className="facet-group">
          <h3>Brands</h3>
          <div data-testid="facet-brands">
            {facets.brands.map((f) => (
              <button
                key={f.name}
                data-testid="facet-brand-item"
                data-brand-name={f.name}
                className={`facet-item ${brand === f.name ? "active" : ""}`}
                onClick={() => handleBrandFacetClick(f.name)}
              >
                {f.name} ({f.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Section */}
      {isLoading && allProducts.length === 0 && (
        <div className="loading">Loading products...</div>
      )}

      {error && <div className="error">Error loading products: {error.message}</div>}

      <div data-testid="product-list" className="product-list">
        {allProducts.map((product) => (
          <div
            key={product.id}
            data-testid="product-item"
            data-product-id={product.id}
            className="product-item"
          >
            <h3 data-testid="product-name">{product.name}</h3>
            <div className="product-details">
              <span data-testid="product-category">{product.category}</span>
              <span data-testid="product-brand">{product.brand}</span>
              <span data-testid="product-price">${product.price.toFixed(2)}</span>
              <span data-testid="product-rating">★ {product.rating}</span>
              <span className={product.inStock ? "in-stock" : "out-of-stock"}>
                {product.inStock ? "In Stock" : "Out of Stock"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {allProducts.length === 0 && !isLoading && (
        <div className="no-results">No products found.</div>
      )}

      {nextCursor !== null && (
        <button
          data-testid="load-more-button"
          className="load-more-button"
          onClick={handleLoadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Load More"}
        </button>
      )}
    </main>
  );
}
