const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create two tags
  await prisma.tag.create({ data: { name: 'nodejs' } });
  await prisma.tag.create({ data: { name: 'prisma' } });

  // Create a user
  const user = await prisma.user.create({
    data: {
      email: 'm2m@example.com',
      name: 'M2M User'
    }
  });

  // Create a post connected to both tags
  await prisma.post.create({
    data: {
      title: 'Prisma Node',
      authorId: user.id,
      tags: {
        connect: [{ name: 'nodejs' }, { name: 'prisma' }]
      }
    }
  });

  // Query the post with tags
  const post = await prisma.post.findFirst({
    where: { title: 'Prisma Node' },
    include: { tags: true }
  });

  fs.writeFileSync('/home/user/myproject/m2m_result.json', JSON.stringify(post, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
