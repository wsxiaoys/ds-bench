const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // First upsert: creates the record with name 'First Run'
  const first = await prisma.user.upsert({
    where:  { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('After first upsert:', first);

  // Second upsert: record already exists, so it updates name to 'Second Run'
  const second = await prisma.user.upsert({
    where:  { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('After second upsert:', second);

  // Confirm the final state by fetching the record
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' },
  });
  console.log('Final record:', user);

  fs.writeFileSync(
    '/home/user/myproject/upsert_result.json',
    JSON.stringify(user, null, 2)
  );
  console.log('Result written to upsert_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
