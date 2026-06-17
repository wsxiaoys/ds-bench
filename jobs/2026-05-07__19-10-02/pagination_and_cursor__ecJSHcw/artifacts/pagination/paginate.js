const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  });

  const lastCursor = page1[page1.length - 1];
  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1,
    cursor: { id: lastCursor.id },
    orderBy: { id: 'asc' },
  });

  const output = { page1, page2 };
  const outputPath = path.join(__dirname, 'paginate_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
