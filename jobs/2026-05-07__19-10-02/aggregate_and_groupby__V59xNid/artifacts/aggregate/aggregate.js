const { PrismaClient } = require('@prisma/client');

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

  const result = {
    totals: {
      count: totals._count,
      sum: totals._sum.amount,
      avg: totals._avg.amount,
    },
    byStatus,
  };

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/aggregate_result.json',
    JSON.stringify(result, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
