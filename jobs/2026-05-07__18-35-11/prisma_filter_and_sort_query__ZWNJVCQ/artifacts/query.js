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

  const outputPath = path.join(__dirname, 'query_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(users, null, 2));

  console.log(`Found ${users.length} user(s) whose name starts with 'A':`);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
