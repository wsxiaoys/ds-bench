const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkout(productId, quantity) {
  return prisma.$transaction(async (tx) => {
    // 1. Read the product and check stock
    const product = await tx.product.findUnique({ where: { id: productId } });

    if (!product || product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // 2. Decrement stock
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    // 3. Create order
    const order = await tx.order.create({
      data: { productId, quantity },
    });

    return order;
  });
}

async function main() {
  // Successful checkout: product has 10 stock, deduct 3
  const order1 = await checkout(1, 3);
  console.log('Checkout succeeded:', order1);

  // Failed checkout: only 7 remaining, trying to deduct 100
  let insufficientStockCaught = false;
  try {
    await checkout(1, 100);
  } catch (err) {
    if (err.message === 'Insufficient stock') {
      insufficientStockCaught = true;
      console.log('Caught expected error:', err.message);
    } else {
      throw err;
    }
  }

  // Read final state
  const product = await prisma.product.findUnique({ where: { id: 1 } });
  const orderCount = await prisma.order.count({ where: { productId: 1 } });

  const result = {
    finalStock: product.stock,
    orderCount,
    insufficientStockCaught,
  };

  console.log('Result:', result);

  fs.writeFileSync(
    '/home/user/myproject/checkout_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Written to checkout_result.json');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
