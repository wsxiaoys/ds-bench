const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkout(productId, quantity) {
  return prisma.$transaction(async (tx) => {
    // 1. Read the product and verify sufficient stock
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error('Product not found');
    }
    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // 2. Decrement the stock
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    // 3. Create the order
    const order = await tx.order.create({
      data: { productId, quantity },
    });

    return order;
  });
}

async function main() {
  let insufficientStockCaught = false;

  // Should succeed — product has 10 stock
  try {
    const order = await checkout(1, 3);
    console.log('Checkout succeeded, order created:', order);
  } catch (err) {
    console.error('Unexpected error during first checkout:', err.message);
  }

  // Should fail — insufficient stock
  try {
    await checkout(1, 100);
  } catch (err) {
    console.error('Checkout failed as expected:', err.message);
    insufficientStockCaught = err.message === 'Insufficient stock';
  }

  // Read final state
  const product = await prisma.product.findUnique({ where: { id: 1 } });
  const orderCount = await prisma.order.count();

  const result = {
    finalStock: product.stock,
    orderCount: orderCount,
    insufficientStockCaught: insufficientStockCaught,
  };

  fs.writeFileSync(
    '/home/user/myproject/checkout_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Result written:', result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });