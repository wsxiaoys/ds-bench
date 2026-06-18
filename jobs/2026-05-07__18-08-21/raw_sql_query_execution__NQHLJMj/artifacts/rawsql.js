const { PrismaClient } = require('@prisma/client');
const { Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Use $queryRaw with a tagged template literal to count users
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;

  // Use $executeRaw to update all users' names to uppercase
  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;

  // Query all users after the update
  const users = await prisma.user.findMany();

  // Write results to JSON file
  const result = {
    countResult: countResult,
    users: users
  };

  const fs = require('fs');
  fs.writeFileSync('/home/user/myproject/rawsql_result.json', JSON.stringify(result, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, 2));

  console.log('Results written to rawsql_result.json');
  console.log('Count result:', countResult);
  console.log('Users:', users);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });