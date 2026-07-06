const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clean up any previously created data so the script is idempotent.
  await prisma.post.deleteMany({});
  await prisma.user.deleteMany({});

  // Create a user with two posts via a nested write.
  await prisma.user.create({
    data: {
      email: 'author@example.com',
      name: 'Author',
      posts: {
        create: [{ title: 'Post One' }, { title: 'Post Two' }],
      },
    },
  });

  // Query the user with their posts included.
  const userWithPosts = await prisma.user.findUnique({
    where: { email: 'author@example.com' },
    include: { posts: true },
  });

  // Write the result to relation_result.json.
  const outputPath = path.join(__dirname, 'relation_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(userWithPosts, null, 2));

  console.log('Wrote result to', outputPath);
  console.log(JSON.stringify(userWithPosts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });