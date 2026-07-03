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

  // Create two tags
  await prisma.tag.create({ data: { name: 'nodejs' } });
  await prisma.tag.create({ data: { name: 'prisma' } });

  // Create a post connected to both tags using connect
  const createdPost = await prisma.post.create({
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
    where: { id: createdPost.id },
    include: { tags: true },
  });

  // Write result to JSON
  fs.writeFileSync(
    '/home/user/myproject/m2m_result.json',
    JSON.stringify(postWithTags, null, 2),
  );

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