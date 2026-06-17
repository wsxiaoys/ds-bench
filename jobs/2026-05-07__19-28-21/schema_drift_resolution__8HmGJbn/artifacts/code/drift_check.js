const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create a user with bio
  const user = await prisma.user.create({
    data: {
      email: `test_${Date.now()}@example.com`,
      bio: 'Hello world',
    },
  });

  // Read it back
  const readUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  // Write to drift_result.json
  fs.writeFileSync(
    '/home/user/myproject/drift_result.json',
    JSON.stringify(readUser, null, 2)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
