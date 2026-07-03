const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Aggregate
    const aggregateResult = await prisma.order.aggregate({
      _count: true,
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
    });

    // 2. GroupBy
    const groupByResult = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      _sum: {
        amount: true,
      },
    });

    // 3. Format result
    const result = {
      totals: {
        count: aggregateResult._count,
        sum: aggregateResult._sum.amount,
        avg: aggregateResult._avg.amount,
      },
      byStatus: groupByResult,
    };

    // 4. Write result to JSON file
    const outputPath = path.join(__dirname, 'aggregate_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log('Successfully wrote aggregate_result.json:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error executing aggregation/groupby:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
