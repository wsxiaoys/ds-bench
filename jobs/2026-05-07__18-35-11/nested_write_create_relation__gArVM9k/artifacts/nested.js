const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.create({
    data: {
      email: 'nested@example.com',
      name: 'Nested Writer',
      posts: {
        create: [
          { title: 'Nested Post A' },
          { title: 'Nested Post B' }
        ]
      }
    },
    include: { posts: true }
  });

  console.log('Created user with nested posts:', JSON.stringify(result, null, 2));

  fs.writeFileSync(
    '/home/user/myproject/nested_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Result written to nested_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
