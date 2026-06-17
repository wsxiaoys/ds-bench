const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.document.upsert({
    where: { id: 1 },
    update: { content: 'Draft', version: 1 },
    create: { id: 1, content: 'Draft', version: 1 },
  });
  console.log('Database seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
