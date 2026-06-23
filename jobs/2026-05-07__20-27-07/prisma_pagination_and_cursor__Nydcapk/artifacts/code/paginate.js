const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // Page 1: Fetch first 5 users
    const page1 = await prisma.user.findMany({
      take: 5,
      orderBy: { id: 'asc' },
    });

    // Page 2: Fetch next 5 users using the last cursor from Page 1
    const lastUserInPage1 = page1[page1.length - 1];
    const page2 = await prisma.user.findMany({
      take: 5,
      skip: 1, // Skip the cursor itself
      cursor: { id: lastUserInPage1.id },
      orderBy: { id: 'asc' },
    });

    const result = {
      page1,
      page2,
    };

    const outputPath = path.join(__dirname, 'paginate_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Results written to ${outputPath}`);

  } catch (error) {
    console.error('Error during pagination:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
