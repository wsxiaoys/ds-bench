const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const [deleted, created] = await prisma.$transaction([
    prisma.user.deleteMany({ where: { email: { endsWith: '@old.com' } } }),
    prisma.user.create({ data: { email: 'new@example.com', name: 'New User' } }),
  ]);

  const total = await prisma.user.count();
  const newUser = await prisma.user.findUnique({ where: { email: 'new@example.com' } });

  const result = {
    remaining: total,
    newUserExists: !!newUser,
  };

  fs.writeFileSync('/home/user/myproject/batch_result.json', JSON.stringify(result, null, 2));

  console.log('Deleted count:', deleted.count);
  console.log('Created user:', created);
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
