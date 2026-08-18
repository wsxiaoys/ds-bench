import { useState, useEffect } from "react";
import { useQuery, getProductsWithFilters } from "wasp/client/operations";
import { type Product } from "wasp/entities";
import "./Main.css";

export function MainPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState("price_asc");
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const [products, setProducts] = useState<Product[]>([]);
  const [prevFilters, setPrevFilters] = useState("");

  const { data, isLoading, error } = useQuery(getProductsWithFilters, {
    search,
    category,
    brand,
    minPrice: minPrice === "" ? undefined : Number(minPrice),
    maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
    inStock,
    sortBy: sortBy as any,
    cursor,
    limit: 10,
  });

  const handleFilterChange = (updater: () => void) => {
    updater();
    setCursor(undefined);
  };

  useEffect(() => {
    if (data) {
      const filtersKey = JSON.stringify({ search, category, brand, minPrice, maxPrice, inStock, sortBy });
      if (filtersKey !== prevFilters) {
        setProducts(data.products);
        setPrevFilters(filtersKey);
      } else {
        if (cursor !== undefined) {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const uniqueNewProducts = data.products.filter((p) => !existingIds.has(p.id));
            return [...prev, ...uniqueNewProducts];
          });
        } else {
          setProducts(data.products);
        }
      }
    }
  }, [data, cursor, search, category, brand, minPrice, maxPrice, inStock, sortBy, prevFilters]);

  return (
    <div className="catalog-container">
      <header className="catalog-header">
        <h1>Wasp Product Catalog</h1>
      </header>

      <div className="catalog-layout">
        <aside className="filters-sidebar">
          <h2>Filters</h2>

          <div className="filter-group">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              data-testid="search-input"
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              data-testid="category-filter"
              value={category}
              onChange={(e) => handleFilterChange(() => setCategory(e.target.value))}
            >
              <option value="All">All</option>
              <option value="Electronics">Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Furniture">Furniture</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="brand">Brand</label>
            <select
              id="brand"
              data-testid="brand-filter"
              value={brand}
              onChange={(e) => handleFilterChange(() => setBrand(e.target.value))}
            >
              <option value="All">All</option>
              <option value="VoltCharge">VoltCharge</option>
              <option value="NutriBlend">NutriBlend</option>
              <option value="ErgoComfort">ErgoComfort</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                data-testid="min-price-input"
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setMinPrice(e.target.value === "" ? "" : Number(e.target.value))
                  )
                }
              />
              <input
                data-testid="max-price-input"
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))
                  )
                }
              />
            </div>
          </div>

          <div className="filter-group checkbox-group">
            <input
              id="instock"
              data-testid="instock-checkbox"
              type="checkbox"
              checked={inStock}
              onChange={(e) => handleFilterChange(() => setInStock(e.target.checked))}
            />
            <label htmlFor="instock">In Stock Only</label>
          </div>

          <div className="filter-group">
            <label htmlFor="sort">Sort By</label>
            <select
              id="sort"
              data-testid="sort-select"
              value={sortBy}
              onChange={(e) => handleFilterChange(() => setSortBy(e.target.value))}
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="createdAt_desc">Newest Arrivals</option>
            </select>
          </div>

          <div className="facets-section">
            <h3>Categories</h3>
            <div data-testid="facet-categories" className="facet-list">
              {data?.facets?.categories.map((cat) => (
                <div
                  key={cat.name}
                  data-testid="facet-category-item"
                  data-category-name={cat.name}
                  className="facet-item"
                >
                  {cat.name} ({cat.count})
                </div>
              ))}
            </div>

            <h3>Brands</h3>
            <div data-testid="facet-brands" className="facet-list">
              {data?.facets?.brands.map((b) => (
                <div
                  key={b.name}
                  data-testid="facet-brand-item"
                  data-brand-name={b.name}
                  className="facet-item"
                >
                  {b.name} ({b.count})
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="catalog-products">
          {isLoading && products.length === 0 ? (
            <div className="loading">Loading products...</div>
          ) : error ? (
            <div className="error">Error loading products: {error.message}</div>
          ) : products.length === 0 ? (
            <div className="no-results">No products found matching the criteria.</div>
          ) : (
            <>
              <div data-testid="product-list" className="products-grid">
                {products.map((product) => (
                  <div
                    key={product.id}
                    data-testid="product-item"
                    data-product-id={product.id}
                    className="product-card"
                  >
                    <h3 data-testid="product-name">{product.name}</h3>
                    <div className="product-meta">
                      <span data-testid="product-category" className="tag category-tag">
                        {product.category}
                      </span>
                      <span data-testid="product-brand" className="tag brand-tag">
                        {product.brand}
                      </span>
                    </div>
                    <p className="product-description">{product.description}</p>
                    <div className="product-footer">
                      <span data-testid="product-price" className="product-price">
                        ${product.price.toFixed(2)}
                      </span>
                      <span data-testid="product-rating" className="product-rating">
                        ★ {product.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="stock-status">
                      {product.inStock ? (
                        <span className="in-stock">In Stock</span>
                      ) : (
                        <span className="out-of-stock">Out of Stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {data?.nextCursor !== null && data?.nextCursor !== undefined && (
                <div className="pagination-container">
                  <button
                    data-testid="load-more-button"
                    onClick={() => setCursor(data.nextCursor)}
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
