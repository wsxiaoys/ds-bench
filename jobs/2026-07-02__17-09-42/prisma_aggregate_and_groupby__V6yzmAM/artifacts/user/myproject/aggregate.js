const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const totals = await prisma.order.aggregate({
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true },
  });

  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true },
  });

  const result = { totals, byStatus };
  fs.writeFileSync('aggregate_result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
