const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Aggregate: overall statistics across all orders
  const totals = await prisma.order.aggregate({
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true },
  });

  // GroupBy: statistics grouped by status
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true },
  });

  const result = {
    totals: {
      count: totals._count,
      sum: totals._sum.amount,
      avg: totals._avg.amount,
    },
    byStatus: grouped.map((g) => ({
      status: g.status,
      count: g._count,
      sum: g._sum.amount,
    })),
  };

  const outPath = path.join(__dirname, 'aggregate_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

  console.log('Aggregate result written to', outPath);
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