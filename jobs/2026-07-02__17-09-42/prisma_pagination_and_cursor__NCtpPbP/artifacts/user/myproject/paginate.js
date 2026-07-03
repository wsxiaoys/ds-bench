const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Page 1: fetch the first 5 users ordered by id ascending
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' },
  });

  // Page 2: use the last user's id as the cursor, skip the cursor itself, take the next 5
  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1,
    cursor: { id: page1[page1.length - 1].id },
    orderBy: { id: 'asc' },
  });

  const result = { page1, page2 };

  fs.writeFileSync(
    '/home/user/myproject/paginate_result.json',
    JSON.stringify(result, null, 2),
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
