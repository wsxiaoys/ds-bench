const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const created = await prisma.user.create({
    data: {
      email: 'drift_test@example.com',
      name: 'Drift Test',
      bio: 'Hello world',
    },
  });

  const readBack = await prisma.user.findUnique({
    where: { id: created.id },
  });

  const result = {
    id: readBack.id,
    email: readBack.email,
    name: readBack.name,
    bio: readBack.bio,
  };

  fs.writeFileSync(
    '/home/user/myproject/drift_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
