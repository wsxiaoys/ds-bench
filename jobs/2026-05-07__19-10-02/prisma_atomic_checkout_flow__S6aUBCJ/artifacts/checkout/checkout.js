const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function checkout(productId, quantity) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });

    if (!product || product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    return tx.order.create({
      data: {
        productId,
        quantity,
      },
    });
  });
}

async function main() {
  let insufficientStockCaught = false;

  await checkout(1, 3);

  try {
    await checkout(1, 100);
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient stock') {
      insufficientStockCaught = true;
    } else {
      throw error;
    }
  }

  const product = await prisma.product.findUnique({ where: { id: 1 } });
  const orderCount = await prisma.order.count();

  const result = {
    finalStock: product ? product.stock : null,
    orderCount,
    insufficientStockCaught,
  };

  const outputPath = path.join(__dirname, 'checkout_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
