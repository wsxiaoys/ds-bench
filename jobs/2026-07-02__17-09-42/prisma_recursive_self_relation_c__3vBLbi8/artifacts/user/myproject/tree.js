const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const root = await prisma.category.create({
    data: { name: 'Electronics' },
  });
  console.log('Created root:', root);

  const child = await prisma.category.create({
    data: { name: 'Phones', parentId: root.id },
  });
  console.log('Created child:', child);

  const grandchild = await prisma.category.create({
    data: { name: 'Smartphones', parentId: child.id },
  });
  console.log('Created grandchild:', grandchild);

  const result = await prisma.category.findFirst({
    where: { name: 'Electronics' },
    include: { children: { include: { children: true } } },
  });

  fs.writeFileSync('tree_result.json', JSON.stringify(result, null, 2));
  console.log('Wrote result to tree_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
