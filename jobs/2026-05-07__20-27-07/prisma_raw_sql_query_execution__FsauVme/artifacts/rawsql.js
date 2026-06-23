const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Count users using $queryRaw with a tagged template literal
    const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
    console.log('Count Result:', countResult);

    // 2. Update all users' names to uppercase using $executeRaw
    await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
    console.log('User names updated to uppercase.');

    // 3. Query all users after update using prisma.user.findMany()
    const users = await prisma.user.findMany();
    console.log('Users after update:', users);

    // 4. Write results to rawsql_result.json
    const result = {
      countResult,
      users
    };
    // Handle BigInt serialization
    const json = JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2);
    fs.writeFileSync('/home/user/myproject/rawsql_result.json', json);
    console.log('Results written to /home/user/myproject/rawsql_result.json');

  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
