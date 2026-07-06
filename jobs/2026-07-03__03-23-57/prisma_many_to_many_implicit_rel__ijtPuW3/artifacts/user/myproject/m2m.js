const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data to ensure a clean run every time
  await prisma.post.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.user.deleteMany({});

  // Reset sqlite REDACTEDincrement sequences to start IDs from 1
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name='User' OR name='Post' OR name='Tag';`);
  } catch (err) {
    // Ignore if sqlite_sequence table doesn't exist or sequence not found
  }

  // 1. First create a user: { email: 'm2m@example.com', name: 'M2M User' }
  const user = await prisma.user.create({
    data: {
      email: 'm2m@example.com',
      name: 'M2M User'
    }
  });
  console.log('Created User:', user);

  // 2. Create two tags: { name: 'nodejs' } and { name: 'prisma' }
  const tagNodejs = await prisma.tag.create({
    data: { name: 'nodejs' }
  });
  const tagPrisma = await prisma.tag.create({
    data: { name: 'prisma' }
  });
  console.log('Created Tags:', [tagNodejs, tagPrisma]);

  // 3. Create a post connected to both tags using connect:
  // prisma.post.create({ data: { title: 'Prisma Node', authorId: 1, tags: { connect: [{ name: 'nodejs' }, { name: 'prisma' }] } } })
  // We use user.id to be robust, but it will be 1 thanks to the REDACTEDincrement reset.
  const post = await prisma.post.create({
    data: {
      title: 'Prisma Node',
      authorId: user.id,
      tags: {
        connect: [
          { name: 'nodejs' },
          { name: 'prisma' }
        ]
      }
    }
  });
  console.log('Created Post:', post);

  // 4. Query the post with include: { tags: true }
  const result = await prisma.post.findUnique({
    where: { id: post.id },
    include: {
      tags: true
    }
  });

  console.log('Query Result:', JSON.stringify(result, null, 2));

  // 5. Write result to /home/user/myproject/m2m_result.json
  const outputPath = path.join(__dirname, 'm2m_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Result successfully written to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
