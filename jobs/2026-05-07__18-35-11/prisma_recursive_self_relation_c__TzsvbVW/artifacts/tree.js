const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Create root category
  const root = await prisma.category.create({
    data: { name: 'Electronics' },
  });
  console.log('Created root:', root);

  // Create child category
  const child = await prisma.category.create({
    data: { name: 'Phones', parentId: root.id },
  });
  console.log('Created child:', child);

  // Create grandchild category
  const grandchild = await prisma.category.create({
    data: { name: 'Smartphones', parentId: child.id },
  });
  console.log('Created grandchild:', grandchild);

  // Query root with nested children (2 levels deep)
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

  console.log('\nCategory tree:');
  console.log(JSON.stringify(tree, null, 2));

  // Write result to file
  const outputPath = path.join(__dirname, 'tree_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2));
  console.log(`\nResult written to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
