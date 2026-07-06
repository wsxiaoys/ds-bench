const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // First run: creates the user since it doesn't exist
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });

  // Second run: updates the user since it already exists
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });

  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' },
  });

  fs.writeFileSync(
    '/home/user/myproject/upsert_result.json',
    JSON.stringify(user, null, 2),
  );

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });