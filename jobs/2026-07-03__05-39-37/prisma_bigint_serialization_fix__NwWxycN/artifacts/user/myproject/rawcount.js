const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
  // Convert BigInt values to Number so JSON.stringify can serialize them
  fs.writeFileSync('rawcount_result.json', JSON.stringify(result, (key, value) => typeof value === 'bigint' ? Number(value) : value));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
