const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'm2m@example.com',
      name: 'M2M User',
    },
  });

  // Create tags
  await prisma.tag.create({ data: { name: 'nodejs' } });
  await prisma.tag.create({ data: { name: 'prisma' } });

  // Create post connected to tags
  const post = await prisma.post.create({
    data: {
      title: 'Prisma Node',
      authorId: user.id,
      tags: {
        connect: [{ name: 'nodejs' }, { name: 'prisma' }],
      },
    },
  });

  // Query post with tags
  const result = await prisma.post.findUnique({
    where: { id: post.id },
    include: { tags: true },
  });

  console.log(JSON.stringify(result, null, 2));

  fs.writeFileSync('m2m_result.json', JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
