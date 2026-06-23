const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('First upsert: Creating or updating user...');
  const firstUpsert = await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('First upsert result:', firstUpsert);

  console.log('\nSecond upsert: Creating or updating user...');
  const secondUpsert = await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('Second upsert result:', secondUpsert);

  console.log('\nFetching final user record...');
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' },
  });
  console.log('Final user:', user);

  // Write result to JSON file
  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/upsert_result.json',
    JSON.stringify(user, null, 2),
    'utf-8'
  );
  console.log('\nResult saved to upsert_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });