const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Page 1
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' }
  });

  // Page 2
  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1,
    cursor: { id: page1[page1.length - 1].id },
    orderBy: { id: 'asc' }
  });

  const result = {
    page1,
    page2
  };

  fs.writeFileSync(
    path.join(__dirname, 'paginate_result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('Successfully paginated and saved results.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
