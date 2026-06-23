const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Page 1: fetch the first 5 users ordered by id ascending
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  });

  console.log('Page 1:', page1);

  // Page 2: use the last record of page 1 as the cursor, skip 1 to exclude it
  const lastCursorId = page1[page1.length - 1].id;

  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1,
    cursor: { id: lastCursorId },
    orderBy: { id: 'asc' },
  });

  console.log('Page 2:', page2);

  const result = { page1, page2 };

  require('fs').writeFileSync(
    '/home/user/myproject/paginate_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Results written to paginate_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
