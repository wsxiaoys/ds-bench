const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Aggregate: compute total statistics
  const aggregate = await prisma.order.aggregate({
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true },
  });

  // GroupBy: compute statistics by status
  const groupBy = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true },
  });

  // Format the result
  const result = {
    totals: {
      count: aggregate._count,
      sum: aggregate._sum.amount,
      avg: aggregate._avg.amount,
    },
    byStatus: groupBy.map((group) => ({
      status: group.status,
      count: group._count,
      sum: group._sum.amount,
    })),
  };

  // Write result to JSON file
  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/aggregate_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Aggregate result written to aggregate_result.json');
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