const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'm2m@example.com' },
    update: { name: 'M2M User' },
    create: {
      email: 'm2m@example.com',
      name: 'M2M User',
    },
  });

  const tagNames = ['nodejs', 'prisma'];
  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const post = await prisma.post.create({
    data: {
      title: 'Prisma Node',
      authorId: user.id,
      tags: {
        connect: [{ name: 'nodejs' }, { name: 'prisma' }],
      },
    },
    include: {
      tags: true,
    },
  });

  const postWithTags = await prisma.post.findUnique({
    where: { id: post.id },
    include: { tags: true },
  });

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/m2m_result.json',
    JSON.stringify(postWithTags, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
