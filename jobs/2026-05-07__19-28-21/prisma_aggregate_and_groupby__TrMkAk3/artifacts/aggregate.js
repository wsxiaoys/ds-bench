const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const totals = await prisma.order.aggregate({
    _count: true,
    _sum: { amount: true },
    _avg: { amount: true }
  });

  const byStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: true,
    _sum: { amount: true }
  });

  const result = {
    totals: {
      count: totals._count,
      sum: totals._sum.amount,
      avg: totals._avg.amount
    },
    byStatus: byStatus
  };

  fs.writeFileSync('/home/user/myproject/aggregate_result.json', JSON.stringify(result, null, 2));
  
  if (!fs.existsSync('/logs/artifacts')) {
    fs.mkdirSync('/logs/artifacts', { recursive: true });
  }
  fs.writeFileSync('/logs/artifacts/aggregate_result.json', JSON.stringify(result, null, 2));
  fs.copyFileSync('/home/user/myproject/aggregate.js', '/logs/artifacts/aggregate.js');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });