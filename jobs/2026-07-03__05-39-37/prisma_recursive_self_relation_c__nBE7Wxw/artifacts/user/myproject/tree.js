const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing data so the script is idempotent
  await prisma.category.deleteMany({});

  // 1. Create root category: Electronics
  const root = await prisma.category.create({
    data: { name: 'Electronics' },
  });

  // 2. Create child category: Phones (parent = Electronics)
  const child = await prisma.category.create({
    data: { name: 'Phones', parentId: root.id },
  });

  // 3. Create grandchild category: Smartphones (parent = Phones)
  const grandchild = await prisma.category.create({
    data: { name: 'Smartphones', parentId: child.id },
  });

  console.log('Created categories:');
  console.log(`  Root: ${root.name} (id=${root.id})`);
  console.log(`  Child: ${child.name} (id=${child.id}, parentId=${child.parentId})`);
  console.log(`  Grandchild: ${grandchild.name} (id=${grandchild.id}, parentId=${grandchild.parentId})`);

  // 4. Query root with nested includes (two levels deep)
  const tree = await prisma.category.findFirst({
    where: { name: 'Electronics' },
    include: { children: { include: { children: true } } },
  });

  // 5. Write result to tree_result.json
  const outputPath = path.join(__dirname, 'tree_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2));
  console.log(`\nTree result written to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });