const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create root category
  const root = await prisma.category.create({
    data: {
      name: 'Electronics'
    }
  });
  console.log('Created root category:', root);

  // Create child category
  const child = await prisma.category.create({
    data: {
      name: 'Phones',
      parentId: root.id
    }
  });
  console.log('Created child category:', child);

  // Create grandchild category
  const grandchild = await prisma.category.create({
    data: {
      name: 'Smartphones',
      parentId: child.id
    }
  });
  console.log('Created grandchild category:', grandchild);

  // Query root with nested includes
  const result = await prisma.category.findFirst({
    where: { name: 'Electronics' },
    include: {
      children: {
        include: {
          children: true
        }
      }
    }
  });

  console.log('Query result:', JSON.stringify(result, null, 2));

  // Write result to JSON file
  fs.writeFileSync('/home/user/myproject/tree_result.json', JSON.stringify(result, null, 2));
  console.log('Result saved to tree_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });