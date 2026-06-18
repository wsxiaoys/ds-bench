const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkout(productId, quantity) {
  return await prisma.$transaction(async (tx) => {
    // 1. Read the product and check stock
    const product = await tx.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // 2. Decrement stock
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } }
    });

    // 3. Create order
    const order = await tx.order.create({
      data: { productId, quantity }
    });

    return order;
  });
}

async function main() {
  let insufficientStockCaught = false;

  try {
    // Ensure product exists with id=1 and stock=10
    const existingProduct = await prisma.product.findUnique({
      where: { id: 1 }
    });

    if (!existingProduct) {
      await prisma.product.create({
        data: { id: 1, name: 'Sample Product', stock: 10 }
      });
    } else if (existingProduct.stock !== 10) {
      // Reset stock to 10 if it exists
      await prisma.product.update({
        where: { id: 1 },
        data: { stock: 10 }
      });
    }

    // Clear existing orders for product 1
    await prisma.order.deleteMany({
      where: { productId: 1 }
    });

    console.log('Initial state: Product 1 has stock 10');

    // Test 1: Successful checkout (checkout 3 items)
    console.log('\nTest 1: Checking out 3 items...');
    const order1 = await checkout(1, 3);
    console.log('✓ Order created successfully:', { orderId: order1.id, quantity: order1.quantity });

    // Verify stock after first checkout
    const productAfterFirst = await prisma.product.findUnique({
      where: { id: 1 }
    });
    console.log('  Stock after first checkout:', productAfterFirst.stock);

    // Test 2: Failed checkout (checkout 100 items - insufficient stock)
    console.log('\nTest 2: Attempting to checkout 100 items...');
    try {
      await checkout(1, 100);
      console.log('✗ Should have failed but succeeded');
    } catch (error) {
      console.log('✓ Caught expected error:', error.message);
      insufficientStockCaught = true;
    }

    // Verify stock after failed checkout (should still be 7)
    const productAfterSecond = await prisma.product.findUnique({
      where: { id: 1 }
    });
    console.log('  Stock after failed checkout:', productAfterSecond.stock);

    // Get final order count
    const orderCount = await prisma.order.count({
      where: { productId: 1 }
    });

    console.log('\nFinal state:');
    console.log('  Product stock:', productAfterSecond.stock);
    console.log('  Order count:', orderCount);
    console.log('  Insufficient stock caught:', insufficientStockCaught);

    // Write results to JSON file
    const result = {
      finalStock: productAfterSecond.stock,
      orderCount: orderCount,
      insufficientStockCaught: insufficientStockCaught
    };

    fs.writeFileSync(
      '/home/user/myproject/checkout_result.json',
      JSON.stringify(result, null, 2)
    );

    console.log('\n✓ Results written to checkout_result.json');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();