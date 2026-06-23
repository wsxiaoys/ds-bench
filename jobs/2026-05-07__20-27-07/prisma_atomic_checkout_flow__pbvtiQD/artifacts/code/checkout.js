const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function checkout(productId, quantity) {
  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    await tx.order.create({
      data: { productId, quantity },
    });

    return { success: true };
  });
}

async function run() {
  let insufficientStockCaught = false;

  try {
    // Call checkout(1, 3) (should succeed — product has 10 stock)
    await checkout(1, 3);
    console.log('Checkout(1, 3) succeeded');

    // Call checkout(1, 100) wrapped in try/catch (should fail — insufficient stock)
    try {
      await checkout(1, 100);
    } catch (error) {
      if (error.message === 'Insufficient stock') {
        insufficientStockCaught = true;
        console.log('Checkout(1, 100) failed as expected: Insufficient stock');
      } else {
        console.error('Unexpected error:', error);
      }
    }

    // After both calls, read final product stock and order count
    const finalProduct = await prisma.product.findUnique({ where: { id: 1 } });
    const orderCount = await prisma.order.count();

    const result = {
      finalStock: finalProduct.stock,
      orderCount: orderCount,
      insufficientStockCaught: insufficientStockCaught,
    };

    fs.writeFileSync('checkout_result.json', JSON.stringify(result, null, 2));
    console.log('Results written to checkout_result.json');
    console.log(result);

  } catch (error) {
    console.error('Error in run:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
