const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const userWithPosts = await prisma.user.create({
    data: {
      email: 'nested@example.com',
      name: 'Nested Writer',
      posts: {
        create: [{ title: 'Nested Post A' }, { title: 'Nested Post B' }],
      },
    },
    include: { posts: true },
  });

  const outputPath = path.join(__dirname, 'nested_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(userWithPosts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
