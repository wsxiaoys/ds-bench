const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create two tags
  const nodejsTag = await prisma.tag.upsert({
    where: { name: 'nodejs' },
    update: {},
    create: { name: 'nodejs' },
  });

  const prismaTag = await prisma.tag.upsert({
    where: { name: 'prisma' },
    update: {},
    create: { name: 'prisma' },
  });

  // Create a user first
  const user = await prisma.user.upsert({
    where: { email: 'm2m@example.com' },
    update: {},
    create: { email: 'm2m@example.com', name: 'M2M User' },
  });

  // Create a post connected to both tags
  const post = await prisma.post.create({
    data: {
      title: 'Prisma Node',
      authorId: user.id,
      tags: {
        connect: [{ name: 'nodejs' }, { name: 'prisma' }],
      },
    },
  });

  // Query the post with tags included
  const postWithTags = await prisma.post.findUnique({
    where: { id: post.id },
    include: { tags: true },
  });

  // Write result to JSON file
  fs.writeFileSync('/home/user/myproject/m2m_result.json', JSON.stringify(postWithTags, null, 2));

  console.log('Result saved to m2m_result.json');
  console.log(JSON.stringify(postWithTags, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });