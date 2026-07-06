const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // 1. Create two tags
  const tagNodejs = await prisma.tag.create({ data: { name: 'nodejs' } });
  const tagPrisma = await prisma.tag.create({ data: { name: 'prisma' } });
  console.log('Created tags:', tagNodejs, tagPrisma);

  // 2. Create a user (author) so we can reference authorId: 1
  const user = await prisma.user.create({
    data: { email: 'm2m@example.com', name: 'M2M User' },
  });
  console.log('Created user:', user);

  // 3. Create a post connected to both tags using `connect`
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

  // 4. Query the post with its tags included
  const result = await prisma.post.findUnique({
    where: { id: post.id },
    include: { tags: true },
  });
  console.log('Post with tags:', result);

  // 5. Write result to m2m_result.json
  fs.writeFileSync('m2m_result.json', JSON.stringify(result, null, 2));
  console.log('Wrote result to m2m_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });