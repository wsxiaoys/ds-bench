const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: { email: 'alice@example.com', name: 'Alice' }
  });
  await prisma.user.create({
    data: { email: 'bob@example.com', name: 'Bob' }
  });
  await prisma.user.create({
    data: { email: 'carol@example.com', name: 'Carol' }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
