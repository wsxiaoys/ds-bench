const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;

  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;

  const users = await prisma.user.findMany();

  const result = {
    countResult,
    users,
  };

  const fs = require('fs');
  const json = JSON.stringify(
    result,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
  fs.writeFileSync('rawsql_result.json', json);
}

main()
  .catch((error) => {
    console.error('Error running raw SQL script:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
