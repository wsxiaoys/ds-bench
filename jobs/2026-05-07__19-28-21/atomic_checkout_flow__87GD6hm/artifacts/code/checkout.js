const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkout(productId, quantity) {
  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });
    
    if (!product || product.stock < quantity) {
      throw new Error('Insufficient stock');
    }
    
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });
    
    await tx.order.create({
      data: { productId, quantity },
    });
  });
}

async function main() {
  let insufficientStockCaught = false;

  // Reset state to ensure id=1 has 10 stock and no orders
  await prisma.order.deleteMany({});
  await prisma.product.upsert({
    where: { id: 1 },
    update: { stock: 10 },
    create: { id: 1, name: 'Test Product', stock: 10 }
  });

  try {
    await checkout(1, 3);
  } catch (e) {
    console.error(e);
  }

  try {
    await checkout(1, 100);
  } catch (e) {
    if (e.message === 'Insufficient stock') {
      insufficientStockCaught = true;
    }
  }

  const finalProduct = await prisma.product.findUnique({ where: { id: 1 } });
  const orderCount = await prisma.order.count();

  const result = {
    finalStock: finalProduct.stock,
    orderCount,
    insufficientStockCaught
  };

  fs.writeFileSync('/home/user/myproject/checkout_result.json', JSON.stringify(result, null, 2));
  
  // Save artifacts
  if (!fs.existsSync('/logs/artifacts/code')) {
    fs.mkdirSync('/logs/artifacts/code', { recursive: true });
  }
  fs.copyFileSync('/home/user/myproject/checkout.js', '/logs/artifacts/code/checkout.js');
  fs.copyFileSync('/home/user/myproject/checkout_result.json', '/logs/artifacts/code/checkout_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
