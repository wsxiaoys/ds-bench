const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.$queryRaw`SELECT * FROM "_PostToTag"`;
  fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));
  await prisma.$executeRaw`DELETE FROM "_PostToTag"`;
  console.log('Backed up and emptied _PostToTag');
}

main().finally(() => prisma.$disconnect());