const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Count users using $queryRaw with a tagged template literal
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;

  // Update all users' names to uppercase using $executeRaw
  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;

  // Query all users after the update
  const users = await prisma.user.findMany();

  // Write results to JSON file
  const result = {
    countResult,
    users,
  };

  fs.writeFileSync(
    '/home/user/myproject/rawsql_result.json',
    JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value,
      2)
  );

  console.log('Result written to rawsql_result.json');
  console.log(
    JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value,
      2)
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