const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob',
    },
  });
  const carol = await prisma.user.create({
    data: {
      email: 'carol@example.com',
      name: 'Carol',
    },
  });
  console.log({ alice, bob, carol });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
