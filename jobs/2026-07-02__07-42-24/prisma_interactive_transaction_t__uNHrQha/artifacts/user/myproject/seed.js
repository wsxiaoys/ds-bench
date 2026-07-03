const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clear any existing accounts to start clean
  await prisma.account.deleteMany({});

  // Seed Alice and Bob
  await prisma.account.create({
    data: {
      owner: 'alice',
      balance: 100,
    },
  });

  await prisma.account.create({
    data: {
      owner: 'bob',
      balance: 50,
    },
  });

  console.log('Database seeded successfully: Alice (100), Bob (50)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
