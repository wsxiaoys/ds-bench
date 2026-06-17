const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // Aggregate: count, sum, avg
    const totalsResult = await prisma.order.aggregate({
      _count: true,
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
    });

    // GroupBy: by status, count, sum
    const byStatusResult = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      _sum: {
        amount: true,
      },
    });

    const result = {
      totals: {
        count: totalsResult._count,
        sum: totalsResult._sum.amount,
        avg: totalsResult._avg.amount,
      },
      byStatus: byStatusResult.map(item => ({
        status: item.status,
        count: item._count,
        sum: item._sum.amount,
      })),
    };

    const outputPath = path.join(__dirname, 'aggregate_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Results written to ${outputPath}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
