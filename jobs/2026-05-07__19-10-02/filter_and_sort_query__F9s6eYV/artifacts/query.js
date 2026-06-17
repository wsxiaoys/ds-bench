const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

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

  fs.writeFileSync('query_result.json', JSON.stringify(users, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
