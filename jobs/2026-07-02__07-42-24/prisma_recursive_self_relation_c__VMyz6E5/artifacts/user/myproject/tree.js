const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clear any existing categories to ensure a clean run
  await prisma.category.deleteMany({});

  // Create root: Electronics
  const root = await prisma.category.create({
    data: { name: 'Electronics' }
  });

  // Create child: Phones
  const child = await prisma.category.create({
    data: {
      name: 'Phones',
      parentId: root.id
    }
  });

  // Create grandchild: Smartphones
  const grandchild = await prisma.category.create({
    data: {
      name: 'Smartphones',
      parentId: child.id
    }
  });

  // Query root with nested includes
  const result = await prisma.category.findFirst({
    where: { name: 'Electronics' },
    include: { children: { include: { children: true } } }
  });

  // Write result to tree_result.json
  const outputPath = path.join(__dirname, 'tree_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('Successfully wrote result to tree_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
