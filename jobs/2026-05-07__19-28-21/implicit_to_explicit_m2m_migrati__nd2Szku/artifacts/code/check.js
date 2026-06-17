const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oldData = await prisma.$queryRaw`SELECT * FROM "_PostToTag"`;
  console.log('oldData', oldData);
  const newData = await prisma.$queryRaw`SELECT * FROM "PostTag"`;
  console.log('newData', newData);
}

main().finally(() => prisma.$disconnect());