const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Execute both operations atomically in a single transaction:
  // 1. Delete all users whose email ends with '@old.com'
  // 2. Create one new user
  await prisma.$transaction([
    prisma.user.deleteMany({
      where: {
        email: { endsWith: '@old.com' },
      },
    }),
    prisma.user.create({
      data: {
        email: 'new@example.com',
        name: 'New User',
      },
    }),
  ]);

  // Query total remaining user count
  const remaining = await prisma.user.count();

  // Check whether the new user was created successfully
  const newUser = await prisma.user.findUnique({
    where: { email: 'new@example.com' },
  });

  const result = {
    remaining,
    newUserExists: newUser !== null,
  };

  console.log('Transaction complete:', result);

  fs.writeFileSync(
    '/home/user/myproject/batch_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Result written to batch_result.json');
}

main()
  .catch((e) => {
    console.error('Transaction failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
