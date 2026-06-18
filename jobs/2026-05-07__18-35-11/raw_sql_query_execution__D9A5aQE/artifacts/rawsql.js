const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Count users using raw SQL
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;

  // Update all users' names to uppercase using raw SQL
  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;

  // Query all users after the update using the Prisma query builder
  const users = await prisma.user.findMany();

  // Write results to JSON file — serialize BigInt values as strings
  const output = { countResult, users };
  const replacer = (_, value) =>
    typeof value === 'bigint' ? value.toString() : value;
  fs.writeFileSync(
    '/home/user/myproject/rawsql_result.json',
    JSON.stringify(output, replacer, 2)
  );

  console.log('countResult:', JSON.stringify(countResult, replacer, 2));
  console.log('users after update:', JSON.stringify(users, replacer, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
