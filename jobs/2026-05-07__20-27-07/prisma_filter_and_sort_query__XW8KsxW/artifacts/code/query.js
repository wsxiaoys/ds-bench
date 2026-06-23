const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        name: {
          startsWith: 'A',
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const outputPath = path.join(__dirname, 'query_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(users, null, 2));
    console.log(`Results written to ${outputPath}`);
  } catch (error) {
    console.error('Error executing query:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
