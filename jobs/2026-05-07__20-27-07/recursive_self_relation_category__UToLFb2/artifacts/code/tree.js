const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Create root
  const root = await prisma.category.create({
    data: { name: 'Electronics' },
  });
  console.log('Created root:', root);

  // Create child
  const child = await prisma.category.create({
    data: {
      name: 'Phones',
      parentId: root.id,
    },
  });
  console.log('Created child:', child);

  // Create grandchild
  const grandchild = await prisma.category.create({
    data: {
      name: 'Smartphones',
      parentId: child.id,
    },
  });
  console.log('Created grandchild:', grandchild);

  // Query root with nested includes
  const tree = await prisma.category.findFirst({
    where: { name: 'Electronics' },
    include: {
      children: {
        include: {
          children: true,
        },
      },
    },
  });

  console.log('Queried tree:', JSON.stringify(tree, null, 2));

  // Write result to tree_result.json
  fs.writeFileSync(
    path.join(__dirname, 'tree_result.json'),
    JSON.stringify(tree, null, 2)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
