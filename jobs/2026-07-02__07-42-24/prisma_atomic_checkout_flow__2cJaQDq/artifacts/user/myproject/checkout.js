const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function checkout(productId, quantity) {
  return await prisma.$transaction(async (tx) => {
    // 1. Read the product and check product.stock >= quantity
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // 2. Decrement stock: tx.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } })
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    // 3. Create order: tx.order.create({ data: { productId, quantity } })
    const order = await tx.order.create({
      data: { productId, quantity },
    });

    return { product: updatedProduct, order };
  });
}

async function run() {
  let insufficientStockCaught = false;

  try {
    // Call checkout(1, 3) (should succeed — product has 10 stock)
    console.log('Attempting checkout(1, 3)...');
    const res1 = await checkout(1, 3);
    console.log('Checkout(1, 3) succeeded:', res1);
  } catch (err) {
    console.error('Checkout(1, 3) failed unexpectedly:', err);
  }

  try {
    // Call checkout(1, 100) wrapped in try/catch (should fail — insufficient stock)
    console.log('Attempting checkout(1, 100)...');
    await checkout(1, 100);
    console.log('Checkout(1, 100) succeeded unexpectedly!');
  } catch (err) {
    console.log('Checkout(1, 100) failed as expected:', err.message);
    if (err.message === 'Insufficient stock') {
      insufficientStockCaught = true;
    }
  }

  // After both calls, read final product stock and order count
  const finalProduct = await prisma.product.findUnique({
    where: { id: 1 },
  });
  const orderCount = await prisma.order.count();

  console.log('Final product stock:', finalProduct ? finalProduct.stock : 'N/A');
  console.log('Total order count:', orderCount);

  // Write to /home/user/myproject/checkout_result.json
  const result = {
    finalStock: finalProduct ? finalProduct.stock : null,
    orderCount: orderCount,
    insufficientStockCaught: insufficientStockCaught,
  };

  fs.writeFileSync(
    '/home/user/myproject/checkout_result.json',
    JSON.stringify(result, null, 2)
  );
  console.log('Result written to checkout_result.json');
}

run()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
