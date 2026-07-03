const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: {
        startsWith: 'A',
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  fs.writeFileSync(
    path.join(__dirname, 'query_result.json'),
    JSON.stringify(users, null, 2),
    'utf-8'
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
