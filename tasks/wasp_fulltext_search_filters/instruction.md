# Wasp Product Catalog with Full-Text Search, Multi-Faceted Filtering, and Sorting

## Background
In modern e-commerce applications, a robust product catalog search is crucial. It requires combining full-text search, multi-faceted filtering (e.g., category, brand, price, stock availability), and dynamic sorting, all while maintaining high performance using pagination and database-level aggregations.

In this task, you will build a Product Catalog web application using the **Wasp framework (^0.24.0)** with **PostgreSQL** as the database. You will implement a custom query that performs PostgreSQL full-text search via Prisma, calculates dynamic facet counts matching the current search/filter criteria, and supports cursor-based pagination.

## Requirements

### 1. Database Schema (`schema.prisma`)
Define a `Product` entity in `schema.prisma` with the following fields:
- `id`: Int @id @default(autoincrement())
- `name`: String
- `description`: String
- `category`: String
- `brand`: String
- `price`: Float
- `rating`: Float
- `inStock`: Boolean
- `createdAt`: DateTime @default(now())

Configure your Prisma client generator to enable PostgreSQL full-text search:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}
```

### 2. Database Seeding
Your application must seed the database with the following 6 products when initialized or started:
1. **Product 1**:
   - Name: `SuperFast Wireless Charger`
   - Description: `A high-speed wireless charging pad for all Qi-enabled smartphones and devices.`
   - Category: `Electronics`
   - Brand: `VoltCharge`
   - Price: `29.99`
   - Rating: `4.5`
   - InStock: `true`
2. **Product 2**:
   - Name: `UltraQuiet Blending Machine`
   - Description: `Professional grade blender with sound dampening shield and 1200W motor.`
   - Category: `Home & Kitchen`
   - Brand: `NutriBlend`
   - Price: `89.99`
   - Rating: `4.8`
   - InStock: `true`
3. **Product 3**:
   - Name: `Ergonomic Office Desk Chair`
   - Description: `High-back mesh chair with adjustable lumbar support and 3D armrests.`
   - Category: `Furniture`
   - Brand: `ErgoComfort`
   - Price: `149.99`
   - Rating: `4.2`
   - InStock: `false`
4. **Product 4**:
   - Name: `VoltCharge Portable Power Bank`
   - Description: `Compact 20000mAh external battery pack with dual USB-C fast charging.`
   - Category: `Electronics`
   - Brand: `VoltCharge`
   - Price: `39.99`
   - Rating: `4.6`
   - InStock: `true`
5. **Product 5**:
   - Name: `NutriBlend Compact Juicer`
   - Description: `Centrifugal juicing machine with wide feed chute, easy to clean.`
   - Category: `Home & Kitchen`
   - Brand: `NutriBlend`
   - Price: `49.99`
   - Rating: `4.0`
   - InStock: `true`
6. **Product 6**:
   - Name: `Leather Executive Swivel Chair`
   - Description: `Premium genuine leather office chair with padded armrests and tilt lock.`
   - Category: `Furniture`
   - Brand: `ErgoComfort`
   - Price: `249.99`
   - Rating: `4.7`
   - InStock: `true`

### 3. Backend Query (`getProductsWithFilters`)
Declare and implement a Wasp query named `getProductsWithFilters` that reads from the `Product` entity.
- **Input arguments object**:
  ```typescript
  {
    search?: string;     // Full-text search term across name and description
    category?: string;   // Exact category match
    brand?: string;      // Exact brand match
    minPrice?: number;   // Minimum price (inclusive)
    maxPrice?: number;   // Maximum price (inclusive)
    inStock?: boolean;   // If true, only return products where inStock is true
    sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'createdAt_desc';
    limit?: number;      // Number of items to return (default 10)
    cursor?: number;     // Product ID cursor for pagination
  }
  ```
- **Output object**:
  ```typescript
  {
    products: Product[];
    nextCursor: number | null;
    facets: {
      categories: { name: string; count: number }[];
      brands: { name: string; count: number }[];
    };
  }
  ```
- **Full-Text Search Logic**: Search must perform PostgreSQL full-text search across `name` and `description` using Prisma's `search` modifier (e.g. `name: { search: searchQuery }`), or fallback gracefully if search is empty or invalid.
- **Facet Counts Logic**: The `facets` counts must dynamically reflect the counts of products matching the *current search query and all active filters* (category, brand, price, stock). For example, if a user filters by `inStock: true` and searches for `chair`, the category and brand facet counts must only count products that match both criteria (which would exclude Product 3 since it is out of stock).
- **Pagination**: Implement cursor-based pagination using the product `id`. Return the `nextCursor` representing the last product's ID on the current page if there are more products, or `null` if there are no more products.

### 4. Frontend UI
Create a clean, responsive frontend page in React (`src/MainPage.tsx`) that uses the `getProductsWithFilters` query. The UI elements must use the following `data-testid` attributes to allow deterministic testing:
- **Search input**: `data-testid="search-input"` (input element)
- **Category filter**: `data-testid="category-filter"` (select element with options for categories, plus an "All" option)
- **Brand filter**: `data-testid="brand-filter"` (select element with options for brands, plus an "All" option)
- **Min Price input**: `data-testid="min-price-input"` (input element)
- **Max Price input**: `data-testid="max-price-input"` (input element)
- **In Stock checkbox**: `data-testid="instock-checkbox"` (checkbox input)
- **Sort select**: `data-testid="sort-select"` (select element with options: `price_asc`, `price_desc`, `rating_desc`, `createdAt_desc`)
- **Product list**: `data-testid="product-list"` (container element for the products)
- **Product item**: `data-testid="product-item"` (for each product element, must have a `data-product-id` attribute containing the product's ID)
- **Product name**: `data-testid="product-name"` (within each product item)
- **Product price**: `data-testid="product-price"` (within each product item, displaying the price)
- **Product rating**: `data-testid="product-rating"` (within each product item, displaying the rating)
- **Product category**: `data-testid="product-category"` (within each product item)
- **Product brand**: `data-testid="product-brand"` (within each product item)
- **Facet categories container**: `data-testid="facet-categories"` containing elements with `data-testid="facet-category-item"` and `data-category-name` attribute (e.g. `data-category-name="Electronics"`) showing the category name and its count.
- **Facet brands container**: `data-testid="facet-brands"` containing elements with `data-testid="facet-brand-item"` and `data-brand-name` attribute (e.g. `data-brand-name="VoltCharge"`) showing the brand name and its count.
- **Load More button**: `data-testid="load-more-button"` (button to load the next page of results using cursor pagination; should only be visible/enabled if `nextCursor` is not null).

## Implementation Hints
- Project path: `/home/user/app`
- Start command: `wasp start`
- Port: `3000`
- Configuration: Define the Wasp Spec in `main.wasp.ts` using `@wasp.sh/spec` package. Define the schema in `schema.prisma` in the project root.
- Database: A local PostgreSQL server is available and configured. You must set the database URL in the environment or `.env` file as `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wasp_search` (or similar, depending on the test environment).
- Make sure the app starts successfully and seeds the database correctly before starting the dev server.

