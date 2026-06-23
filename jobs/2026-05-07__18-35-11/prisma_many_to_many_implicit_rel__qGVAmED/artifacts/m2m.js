const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create two tags
  const nodejsTag = await prisma.tag.create({ data: { name: 'nodejs' } });
  const prismaTag = await prisma.tag.create({ data: { name: 'prisma' } });

  console.log('Created tags:', nodejsTag, prismaTag);

  // Create a user
  const user = await prisma.user.create({
    data: { email: 'm2m@example.com', name: 'M2M User' },
  });

  console.log('Created user:', user);

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

  console.log('Created post:', post);

  // Query the post with tags included
  const postWithTags = await prisma.post.findUnique({
    where: { id: post.id },
    include: { tags: true },
  });

  console.log('Post with tags:', JSON.stringify(postWithTags, null, 2));

  // Write result to file
  fs.writeFileSync(
    '/home/user/myproject/m2m_result.json',
    JSON.stringify(postWithTags, null, 2)
  );

  console.log('Result written to m2m_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
