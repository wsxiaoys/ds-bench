import React, { useState, useEffect } from "react";
import { getProductsWithFilters, useQuery } from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState<string>("price_asc");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [accumulatedProducts, setAccumulatedProducts] = useState<any[]>([]);

  // Reset cursor and accumulated products when any filter or sort option changes
  useEffect(() => {
    setCursor(undefined);
  }, [search, category, brand, minPrice, maxPrice, inStock, sortBy]);

  const limit = 2; // small limit to demonstrate pagination

  const { data, isLoading, error } = useQuery(getProductsWithFilters, {
    search,
    category,
    brand,
    minPrice: minPrice !== "" ? Number(minPrice) : undefined,
    maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
    inStock,
    sortBy: sortBy as any,
    limit,
    cursor,
  });

  useEffect(() => {
    if (data) {
      if (cursor === undefined) {
        setAccumulatedProducts(data.products);
      } else {
        setAccumulatedProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = data.products.filter(p => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }
    }
  }, [data, cursor]);

  const handleLoadMore = () => {
    if (data && data.nextCursor !== null) {
      setCursor(data.nextCursor);
    }
  };

  const allCategories = ["Electronics", "Home & Kitchen", "Furniture"];
  const facetCategories = allCategories.map(cat => {
    const match = data?.facets?.categories.find(c => c.name === cat);
    return { name: cat, count: match ? match.count : 0 };
  });

  const allBrands = ["VoltCharge", "NutriBlend", "ErgoComfort"];
  const facetBrands = allBrands.map(br => {
    const match = data?.facets?.brands.find(b => b.name === br);
    return { name: br, count: match ? match.count : 0 };
  });

  return (
    <div className="catalog-container">
      <header className="catalog-header">
        <h1>Product Catalog</h1>
      </header>

      <div className="catalog-layout">
        {/* Sidebar Filters */}
        <aside className="catalog-sidebar">
          <h3>Filters</h3>

          <div className="filter-group">
            <label htmlFor="search-input">Search</label>
            <input
              id="search-input"
              type="text"
              data-testid="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
            />
          </div>

          <div className="filter-group">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              data-testid="category-filter"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="brand-filter">Brand</label>
            <select
              id="brand-filter"
              data-testid="brand-filter"
              value={brand}
              onChange={e => setBrand(e.target.value)}
            >
              <option value="All">All Brands</option>
              {allBrands.map(br => (
                <option key={br} value={br}>
                  {br}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                data-testid="min-price-input"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Min"
              />
              <span className="price-separator">to</span>
              <input
                type="number"
                data-testid="max-price-input"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Max"
              />
            </div>
          </div>

          <div className="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                data-testid="instock-checkbox"
                checked={inStock}
                onChange={e => setInStock(e.target.checked)}
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
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="createdAt_desc">Newest Arrivals</option>
            </select>
          </div>

          {/* Facets */}
          <div className="facets-section">
            <h4>Categories</h4>
            <div data-testid="facet-categories" className="facets-list">
              {facetCategories.map(c => (
                <div
                  key={c.name}
                  data-testid="facet-category-item"
                  data-category-name={c.name}
                  className="facet-item"
                >
                  <span className="facet-name">{c.name}</span>
                  <span className="facet-count">({c.count})</span>
                </div>
              ))}
            </div>

            <h4>Brands</h4>
            <div data-testid="facet-brands" className="facets-list">
              {facetBrands.map(b => (
                <div
                  key={b.name}
                  data-testid="facet-brand-item"
                  data-brand-name={b.name}
                  className="facet-item"
                >
                  <span className="facet-name">{b.name}</span>
                  <span className="facet-count">({b.count})</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Product List */}
        <main className="catalog-main">
          {isLoading && accumulatedProducts.length === 0 ? (
            <div className="loading-state">Loading products...</div>
          ) : error ? (
            <div className="error-state">Error loading products: {String(error)}</div>
          ) : (
            <>
              <div data-testid="product-list" className="product-list">
                {accumulatedProducts.length === 0 ? (
                  <div className="no-products">No products found matching the criteria.</div>
                ) : (
                  accumulatedProducts.map(product => (
                    <div
                      key={product.id}
                      data-testid="product-item"
                      data-product-id={product.id}
                      className="product-card"
                    >
                      <div className="product-info">
                        <h3 data-testid="product-name" className="product-title">
                          {product.name}
                        </h3>
                        <p className="product-desc">{product.description}</p>
                        <div className="product-meta">
                          <span data-testid="product-category" className="meta-tag">
                            {product.category}
                          </span>
                          <span data-testid="product-brand" className="meta-tag">
                            {product.brand}
                          </span>
                        </div>
                      </div>
                      <div className="product-pricing">
                        <span data-testid="product-price" className="product-price-val">
                          ${product.price.toFixed(2)}
                        </span>
                        <div className="product-rating-box">
                          Rating: <span data-testid="product-rating">{product.rating}</span> / 5
                        </div>
                        <span className={`stock-status ${product.inStock ? "in-stock" : "out-of-stock"}`}>
                          {product.inStock ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {data?.nextCursor !== null && (
                <div className="pagination-container">
                  <button
                    data-testid="load-more-button"
                    onClick={handleLoadMore}
                    className="load-more-btn"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
