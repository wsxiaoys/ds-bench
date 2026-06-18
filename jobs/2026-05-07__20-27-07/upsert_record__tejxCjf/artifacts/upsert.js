const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // First run
  console.log('Running first upsert...');
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });

  // Second run
  console.log('Running second upsert...');
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });

  console.log('Fetching user...');
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' },
  });

  console.log('Writing result to upsert_result.json');
  fs.writeFileSync(
    path.join(__dirname, 'upsert_result.json'),
    JSON.stringify(user, null, 2)
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
