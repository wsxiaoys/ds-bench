# Atomic Checkout Flow

## Background
An e-commerce checkout involves multiple database operations that must succeed or fail together: checking stock, decrementing inventory, and creating an order. Using Prisma's interactive transaction guarantees atomicity.

## Requirements
Implement an atomic checkout flow that deducts stock and creates an order in a single transaction, with proper error handling when stock is insufficient.

## Implementation Guide
1. The schema has:
   - `Product`: `id`, `name String`, `stock Int`
   - `Order`: `id`, `productId Int`, `quantity Int`, `product Product @relation(...)`
   - `Product` has `orders Order[]`
2. Create `/home/user/myproject/checkout.js`:
   - Import `PrismaClient`
   - Implement `checkout(productId, quantity)` using `prisma.$transaction(async (tx) => { ... })`:
     1. Read the product and check `product.stock >= quantity`; throw `Error('Insufficient stock')` if not
     2. Decrement stock: `tx.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } })`
     3. Create order: `tx.order.create({ data: { productId, quantity } })`
   - Call `checkout(1, 3)` (should succeed — product has 10 stock)
   - Call `checkout(1, 100)` wrapped in try/catch (should fail — insufficient stock)
   - After both calls, read final product stock and order count
   - Write to `/home/user/myproject/checkout_result.json`:
     `{ "finalStock": <stock>, "orderCount": <count>, "insufficientStockCaught": true }`
3. Run: `node checkout.js`

## Constraints
- Project path: `/home/user/myproject`
- Output file: `/home/user/myproject/checkout_result.json`
- Product id=1 starts with `stock=10`
