import { getProductsWithFilters, useQuery } from "wasp/client/operations";
import { type Product } from "wasp/entities";
import { useState, useEffect } from "react";
import "./Main.css";

export function MainPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "rating_desc" | "createdAt_desc">("price_asc");

  // Cursor pagination state
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Query arguments
  const queryArgs = {
    search,
    category,
    brand,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    inStock,
    sortBy,
    limit: 2, // limit of 2 products per page to demonstrate pagination
    cursor,
  };

  const { data, isLoading } = useQuery(getProductsWithFilters, queryArgs);

  // Sync loaded products with accumulated products list
  useEffect(() => {
    if (data) {
      if (cursor === undefined) {
        setAllProducts(data.products);
      } else {
        setAllProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = data.products.filter(p => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }
    }
  }, [data, cursor]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBrand(e.target.value);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinPrice(e.target.value);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxPrice(e.target.value);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleInStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInStock(e.target.checked);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as any);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleFacetCategoryClick = (catName: string) => {
    // Toggle or select
    const newCategory = category === catName ? "All" : catName;
    setCategory(newCategory);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleFacetBrandClick = (brandName: string) => {
    // Toggle or select
    const newBrand = brand === brandName ? "All" : brandName;
    setBrand(newBrand);
    setCursor(undefined);
    setAllProducts([]);
  };

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const facets = data?.facets;

  return (
    <div className="product-catalog-container">
      <header className="catalog-header">
        <h1>Wasp Product Catalog</h1>
      </header>

      <div className="catalog-layout">
        <aside className="sidebar">
          {/* Category filter */}
          <div className="filter-group">
            <label htmlFor="category-select">Category</label>
            <select
              id="category-select"
              data-testid="category-filter"
              value={category}
              onChange={handleCategoryChange}
            >
              <option value="All">All</option>
              <option value="Electronics">Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Furniture">Furniture</option>
            </select>
          </div>

          {/* Brand filter */}
          <div className="filter-group">
            <label htmlFor="brand-select">Brand</label>
            <select
              id="brand-select"
              data-testid="brand-filter"
              value={brand}
              onChange={handleBrandChange}
            >
              <option value="All">All</option>
              <option value="VoltCharge">VoltCharge</option>
              <option value="NutriBlend">NutriBlend</option>
              <option value="ErgoComfort">ErgoComfort</option>
            </select>
          </div>

          {/* Price filters */}
          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                data-testid="min-price-input"
                placeholder="Min"
                value={minPrice}
                onChange={handleMinPriceChange}
              />
              <span>to</span>
              <input
                type="number"
                data-testid="max-price-input"
                placeholder="Max"
                value={maxPrice}
                onChange={handleMaxPriceChange}
              />
            </div>
          </div>

          {/* In Stock checkbox */}
          <div className="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                data-testid="instock-checkbox"
                checked={inStock}
                onChange={handleInStockChange}
              />
              In Stock Only
            </label>
          </div>

          {/* Facet Categories */}
          <div className="facet-group">
            <h3>Categories</h3>
            <div data-testid="facet-categories" className="facet-list">
              {facets?.categories.map(cat => (
                <div
                  key={cat.name}
                  data-testid="facet-category-item"
                  data-category-name={cat.name}
                  className={`facet-item ${category === cat.name ? "active" : ""}`}
                  onClick={() => handleFacetCategoryClick(cat.name)}
                >
                  <span className="facet-name">{cat.name}</span>
                  <span className="facet-count">({cat.count})</span>
                </div>
              ))}
              {(!facets || facets.categories.length === 0) && (
                <div className="no-facets">No matching categories</div>
              )}
            </div>
          </div>

          {/* Facet Brands */}
          <div className="facet-group">
            <h3>Brands</h3>
            <div data-testid="facet-brands" className="facet-list">
              {facets?.brands.map(b => (
                <div
                  key={b.name}
                  data-testid="facet-brand-item"
                  data-brand-name={b.name}
                  className={`facet-item ${brand === b.name ? "active" : ""}`}
                  onClick={() => handleFacetBrandClick(b.name)}
                >
                  <span className="facet-name">{b.name}</span>
                  <span className="facet-count">({b.count})</span>
                </div>
              ))}
              {(!facets || facets.brands.length === 0) && (
                <div className="no-facets">No matching brands</div>
              )}
            </div>
          </div>
        </aside>

        <main className="main-content">
          {/* Search and Sort */}
          <div className="search-sort-bar">
            <div className="search-wrapper">
              <input
                type="text"
                data-testid="search-input"
                placeholder="Search products..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div className="sort-wrapper">
              <select
                data-testid="sort-select"
                value={sortBy}
                onChange={handleSortByChange}
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating_desc">Highest Rated</option>
                <option value="createdAt_desc">Newest Arrivals</option>
              </select>
            </div>
          </div>

          {/* Product List */}
          {isLoading && allProducts.length === 0 ? (
            <div className="loading">Loading products...</div>
          ) : (
            <>
              <div data-testid="product-list" className="product-list">
                {allProducts.map(product => (
                  <div
                    key={product.id}
                    data-testid="product-item"
                    data-product-id={product.id}
                    className="product-card"
                  >
                    <div className="product-card-header">
                      <span data-testid="product-category" className="badge category-badge">
                        {product.category}
                      </span>
                      <span data-testid="product-brand" className="badge brand-badge">
                        {product.brand}
                      </span>
                    </div>
                    <h2 data-testid="product-name" className="product-card-title">
                      {product.name}
                    </h2>
                    <p className="product-card-description">{product.description}</p>
                    <div className="product-card-footer">
                      <span data-testid="product-price" className="product-card-price">
                        ${product.price.toFixed(2)}
                      </span>
                      <span data-testid="product-rating" className="product-card-rating">
                        ★ {product.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="product-card-stock">
                      {product.inStock ? (
                        <span className="stock-in">In Stock</span>
                      ) : (
                        <span className="stock-out">Out of Stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {allProducts.length === 0 && (
                <div className="no-products">No products found matching your criteria.</div>
              )}

              {/* Load More Button */}
              {data?.nextCursor && (
                <div className="load-more-container">
                  <button
                    data-testid="load-more-button"
                    className="load-more-btn"
                    onClick={handleLoadMore}
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
