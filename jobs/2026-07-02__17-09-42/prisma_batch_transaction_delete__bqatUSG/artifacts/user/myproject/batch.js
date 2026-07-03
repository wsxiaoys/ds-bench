const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const [deleteResult, createdUser] = await prisma.$transaction([
    prisma.user.deleteMany({
      where: { email: { endsWith: '@old.com' } },
    }),
    prisma.user.create({
      data: { email: 'new@example.com', name: 'New User' },
    }),
  ]);

  const totalUsers = await prisma.user.count();

  const existingUser = await prisma.user.findUnique({
    where: { email: 'new@example.com' },
  });

  const result = {
    remaining: totalUsers,
    newUserExists: !!existingUser,
  };

  fs.writeFileSync(
    '/home/user/myproject/batch_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Transaction complete. Deleted:', deleteResult.count, 'New user:', createdUser.email);
  console.log('Result:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
