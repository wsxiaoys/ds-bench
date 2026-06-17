const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'test@example.com';

  await prisma.user.create({
    data: {
      email,
      name: 'Test User',
    },
  });

  const createdUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!createdUser) {
    throw new Error('User not found after creation.');
  }

  await prisma.user.update({
    where: { email },
    data: { name: 'Updated User' },
  });

  await prisma.user.delete({
    where: { email },
  });

  const deletedUser = await prisma.user.findUnique({
    where: { email },
  });

  if (deletedUser !== null) {
    throw new Error('User was not deleted.');
  }

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/crud_result.json',
    JSON.stringify({ status: 'ok', deleted: true }, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
