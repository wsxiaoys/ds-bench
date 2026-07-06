const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { startsWith: 'A' } },
    orderBy: { name: 'asc' }
  });
  fs.writeFileSync('/home/user/myproject/query_result.json', JSON.stringify(users, null, 2));
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
