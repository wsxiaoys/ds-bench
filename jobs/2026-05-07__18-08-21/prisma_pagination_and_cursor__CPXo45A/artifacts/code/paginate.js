const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Page 1: Fetch first 5 users
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' }
  });

  // Page 2: Fetch next 5 users using cursor pagination
  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1, // Skip the cursor item
    cursor: { id: page1[page1.length - 1].id },
    orderBy: { id: 'asc' }
  });

  // Write results to JSON file
  const result = {
    page1: page1,
    page2: page2
  };

  const fs = require('fs');
  fs.writeFileSync('/home/user/myproject/paginate_result.json', JSON.stringify(result, null, 2));

  console.log('Pagination results written to paginate_result.json');
  console.log('Page 1:', page1);
  console.log('Page 2:', page2);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });