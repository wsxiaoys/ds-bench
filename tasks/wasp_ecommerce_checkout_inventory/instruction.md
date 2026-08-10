# Wasp E-commerce Checkout with Inventory Tracking and Concurrency

## Background
Create a highly robust e-commerce shopping cart and checkout application using Wasp (`^0.24.0`). The application must manage a product catalog, handle shopping carts, validate and apply coupon codes, process checkouts, and maintain inventory consistency under concurrent checkout requests.

## Requirements
- **Data Model & Seeding**:
  - Define entities for `Product`, `Coupon`, `Order`, and `OrderItem` in the database schema.
  - Seed the database with the following initial data:
    - Products:
      1. "Premium Wireless Headphones" (Price: $100.00, Inventory: 10)
      2. "Ergonomic Mechanical Keyboard" (Price: $150.00, Inventory: 1)
    - Coupons:
      1. "SAVE20": 20% percentage discount on the entire cart subtotal.
      2. "FLAT50": $50.00 flat discount on the entire cart total (the total cannot go below $0.00).
- **Shopping Cart & Checkout**:
  - Users can add items to their cart.
  - Users can apply a coupon code to get a discount on their cart.
  - Users can initiate checkout to place an order.
  - **Concurrency & Transaction Safety**: The checkout operation must be transaction-safe. If multiple concurrent checkout requests are made for a product with limited stock (e.g., the keyboard with inventory of 1), only one request must succeed and decrement the inventory, while the other concurrent requests must fail with a clear out-of-stock error, and any database changes must roll back.
- **Frontend UI**:
  - Homepage (`/`):
    - Displays the product catalog with name, price, and current available inventory.
    - Contains an "Add to Cart" button next to each product.
    - Displays a cart section showing selected items, quantities, subtotal, discount, and grand total.
    - Contains a coupon input field with placeholder "Enter Coupon Code" or id `coupon-input`.
    - Contains an "Apply Coupon" button with text "Apply Coupon" or id `apply-coupon-btn`.
    - Displays coupon application success/error messages.
    - Contains a "Place Order" button with text "Place Order" or id `checkout-btn`.
    - Displays checkout status/error messages. On success, show a message containing "Order placed successfully! Order ID: <id>" or similar. On failure (e.g., out of stock), show a clear error containing "Insufficient inventory" or "Out of stock".

## Implementation Hints
- **Project Path**: `/home/user/app`
- **Wasp Version**: `^0.24.0` (uses `main.wasp.ts` instead of `.wasp` DSL)
- **Start Command**: `wasp start`
- **Port**: `3000`
- **Database**: PostgreSQL. The application must connect to PostgreSQL using the `DATABASE_URL` environment variable. A local PostgreSQL server will be running on port 5432 in the test environment.
- **Concurrency & Locking**: To ensure transaction-safe inventory adjustments under concurrent requests, you should implement appropriate database locking (e.g., using Prisma interactive transactions `$transaction` or raw database queries like `SELECT ... FOR UPDATE` on the `Product` table).
- **API & Operations**: Declare all queries and actions in `main.wasp.ts` and implement them in `src/` using TypeScript.

