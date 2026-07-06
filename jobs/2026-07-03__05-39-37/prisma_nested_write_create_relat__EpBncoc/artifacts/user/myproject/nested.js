const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await prisma.user.create({
      data: {
        email: 'nested@example.com',
        name: 'Nested Writer',
        posts: {
          create: [
            { title: 'Nested Post A' },
            { title: 'Nested Post B' },
          ],
        },
      },
      include: { posts: true },
    });

    const outputPath = path.join(__dirname, 'nested_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log('Nested write succeeded. Result written to', outputPath);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Nested write failed:', err);
  process.exit(1);
});