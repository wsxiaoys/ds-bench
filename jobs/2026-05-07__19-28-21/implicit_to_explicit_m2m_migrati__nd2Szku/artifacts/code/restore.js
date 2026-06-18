const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('backup.json', 'utf8'));
  for (const row of data) {
    await prisma.$executeRaw`INSERT INTO "_PostToTag" ("A", "B") VALUES (${row.A}, ${row.B})`;
  }
  console.log('Restored _PostToTag');
}

main().finally(() => prisma.$disconnect());