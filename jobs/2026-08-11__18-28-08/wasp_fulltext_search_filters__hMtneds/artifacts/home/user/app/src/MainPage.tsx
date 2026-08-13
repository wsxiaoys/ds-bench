import { useState, useEffect } from "react";
import { useQuery, getProductsWithFilters } from "wasp/client/operations";
import { type Product } from "wasp/entities";

export function MainPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc'>("price_asc");
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const limit = 2; // small limit to demonstrate pagination

  const { data, isLoading, error } = useQuery(getProductsWithFilters, {
    search,
    category,
    brand,
    minPrice: minPrice === "" ? undefined : Number(minPrice),
    maxPrice: maxPrice === "" ? undefined : Number(maxPrice),
    inStock,
    sortBy,
    limit,
    cursor,
  });

  const [products, setProducts] = useState<Product[]>([]);

  // Accumulate products across pages
  useEffect(() => {
    if (data) {
      if (cursor === undefined) {
        setProducts(data.products);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newProducts = data.products.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }
    }
  }, [data, cursor]);

  const handleFilterChange = (updater: () => void) => {
    updater();
    setCursor(undefined);
  };

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 style={{ margin: 0, color: "#333" }}>Product Catalog</h1>
        <p style={{ margin: "5px 0 0", color: "#666" }}>Find the best products with advanced search and filtering</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "30px" }}>
        {/* Sidebar Filters */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Search */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px", color: "#444" }}>Search Products</label>
            <input
              type="text"
              data-testid="search-input"
              value={search}
              onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
              placeholder="Search by name or description..."
              style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }}
            />
          </div>

          {/* Category */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px", color: "#444" }}>Category</label>
            <select
              data-testid="category-filter"
              value={category}
              onChange={(e) => handleFilterChange(() => setCategory(e.target.value))}
              style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px", backgroundColor: "#fff" }}
            >
              <option value="All">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Furniture">Furniture</option>
            </select>
          </div>

          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px", color: "#444" }}>Brand</label>
            <select
              data-testid="brand-filter"
              value={brand}
              onChange={(e) => handleFilterChange(() => setBrand(e.target.value))}
              style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px", backgroundColor: "#fff" }}
            >
              <option value="All">All Brands</option>
              <option value="VoltCharge">VoltCharge</option>
              <option value="NutriBlend">NutriBlend</option>
              <option value="ErgoComfort">ErgoComfort</option>
            </select>
          </div>

          {/* Price Range */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px", color: "#444" }}>Price Range</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="number"
                data-testid="min-price-input"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => handleFilterChange(() => setMinPrice(e.target.value === "" ? "" : Number(e.target.value)))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }}
              />
              <span style={{ color: "#888" }}>-</span>
              <input
                type="number"
                data-testid="max-price-input"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => handleFilterChange(() => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value)))}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }}
              />
            </div>
          </div>

          {/* In Stock */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              id="instock"
              data-testid="instock-checkbox"
              checked={inStock}
              onChange={(e) => handleFilterChange(() => setInStock(e.target.checked))}
              style={{ width: "16px", height: "16px" }}
            />
            <label htmlFor="instock" style={{ fontWeight: "bold", fontSize: "14px", color: "#444", cursor: "pointer" }}>
              In Stock Only
            </label>
          </div>

          {/* Dynamic Facets Display */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: "20px", marginTop: "10px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "16px", color: "#333" }}>Filter Facets</h3>
            
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 5px", fontSize: "14px", color: "#555" }}>Categories</h4>
              <div data-testid="facet-categories" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {data?.facets?.categories.map((cat) => (
                  <div
                    key={cat.name}
                    data-testid="facet-category-item"
                    data-category-name={cat.name}
                    style={{ fontSize: "13px", color: "#666", display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ fontWeight: "bold", color: "#888" }}>({cat.count})</span>
                  </div>
                ))}
                {(!data?.facets?.categories || data.facets.categories.length === 0) && (
                  <div style={{ fontSize: "13px", color: "#999", fontStyle: "italic" }}>No category facets</div>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ margin: "0 0 5px", fontSize: "14px", color: "#555" }}>Brands</h4>
              <div data-testid="facet-brands" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {data?.facets?.brands.map((br) => (
                  <div
                    key={br.name}
                    data-testid="facet-brand-item"
                    data-brand-name={br.name}
                    style={{ fontSize: "13px", color: "#666", display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{br.name}</span>
                    <span style={{ fontWeight: "bold", color: "#888" }}>({br.count})</span>
                  </div>
                ))}
                {(!data?.facets?.brands || data.facets.brands.length === 0) && (
                  <div style={{ fontSize: "13px", color: "#999", fontStyle: "italic" }}>No brand facets</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ color: "#666", fontSize: "14px" }}>
              Showing {products.length} product{products.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "14px", color: "#555" }}>Sort By:</label>
              <select
                data-testid="sort-select"
                value={sortBy}
                onChange={(e) => handleFilterChange(() => setSortBy(e.target.value as any))}
                style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px", backgroundColor: "#fff" }}
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="createdAt_desc">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {error && (
            <div style={{ padding: "20px", backgroundColor: "#fff5f5", color: "#c53030", borderRadius: "4px", marginBottom: "20px" }}>
              Error loading products. Please try again.
            </div>
          )}

          <div
            data-testid="product-list"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginBottom: "30px" }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                data-testid="product-item"
                data-product-id={product.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  transition: "box-shadow 0.2s",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span
                      data-testid="product-category"
                      style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "#0070f3", backgroundColor: "#e6f2ff", padding: "2px 8px", borderRadius: "12px" }}
                    >
                      {product.category}
                    </span>
                    <span
                      data-testid="product-brand"
                      style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}
                    >
                      {product.brand}
                    </span>
                  </div>
                  <h3 data-testid="product-name" style={{ margin: "0 0 10px", fontSize: "16px", color: "#333" }}>
                    {product.name}
                  </h3>
                  <p style={{ margin: "0 0 15px", fontSize: "13px", color: "#666", lineHeight: "1.4" }}>
                    {product.description}
                  </p>
                </div>
                <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span data-testid="product-price" style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span data-testid="product-rating" style={{ fontSize: "13px", color: "#f5a623", fontWeight: "bold" }}>
                      ★ {product.rating.toFixed(1)}
                    </span>
                    <span style={{ fontSize: "11px", color: product.inStock ? "#2ecc71" : "#e74c3c", fontWeight: "600" }}>
                      {product.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {products.length === 0 && !isLoading && (
            <div style={{ textAlign: "center", padding: "50px 0", color: "#888" }}>
              <h3>No products found</h3>
              <p>Try adjusting your search or filter options</p>
            </div>
          )}

          {isLoading && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#666" }}>
              Loading products...
            </div>
          )}

          {/* Load More Pagination */}
          {data?.nextCursor !== null && data?.nextCursor !== undefined && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
              <button
                data-testid="load-more-button"
                onClick={handleLoadMore}
                disabled={isLoading}
                style={{
                  padding: "10px 24px",
                  borderRadius: "4px",
                  border: "1px solid #0070f3",
                  backgroundColor: isLoading ? "#f0f0f0" : "#0070f3",
                  color: isLoading ? "#999" : "#fff",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                {isLoading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
