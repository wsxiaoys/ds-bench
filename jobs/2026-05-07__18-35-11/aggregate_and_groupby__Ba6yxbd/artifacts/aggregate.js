const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Aggregate: overall count, sum, and average of order amounts
  const totalsRaw = await prisma.order.aggregate({
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true },
  });

  const totals = {
    count: totalsRaw._count,
    sum: totalsRaw._sum.amount,
    avg: totalsRaw._avg.amount,
  };

  // GroupBy: break down count and sum by status
  const byStatusRaw = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true },
  });

  const byStatus = byStatusRaw.map((group) => ({
    status: group.status,
    count: group._count,
    sum: group._sum.amount,
  }));

  const result = { totals, byStatus };

  fs.writeFileSync(
    '/home/user/myproject/aggregate_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Results written to aggregate_result.json');
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
