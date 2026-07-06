const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const count = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
  await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
  const users = await prisma.user.findMany();

  const replacer = (key, value) =>
    typeof value === 'bigint' ? value.toString() : value;

  fs.writeFileSync(
    '/home/user/myproject/rawsql_result.json',
    JSON.stringify({ countResult: count, users }, replacer, 2)
  );
  console.log('Done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
