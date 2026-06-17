const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
  // This line crashes: JSON.stringify cannot serialize BigInt
  const json = JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? Number(value) : value));
  fs.writeFileSync('rawcount_result.json', json);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
