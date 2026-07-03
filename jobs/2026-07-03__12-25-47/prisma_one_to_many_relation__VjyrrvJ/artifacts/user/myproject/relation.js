const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: 'author@example.com',
      name: 'Author',
      posts: {
        create: [{ title: 'Post One' }, { title: 'Post Two' }],
      },
    },
  });

  const result = await prisma.user.findUnique({
    where: { email: 'author@example.com' },
    include: { posts: true },
  });

  fs.writeFileSync('/home/user/myproject/relation_result.json', JSON.stringify(result, null, 2));
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
