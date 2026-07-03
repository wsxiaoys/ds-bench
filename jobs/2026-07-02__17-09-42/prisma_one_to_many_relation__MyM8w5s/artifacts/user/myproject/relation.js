const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing user with this email to keep the run idempotent
  await prisma.user.deleteMany({
    where: { email: 'author@example.com' },
  });

  // Create a user with two posts nested
  const createdUser = await prisma.user.create({
    data: {
      email: 'author@example.com',
      name: 'Author',
      posts: {
        create: [{ title: 'Post One' }, { title: 'Post Two' }],
      },
    },
  });

  // Query the user with posts included
  const userWithPosts = await prisma.user.findUnique({
    where: { id: createdUser.id },
    include: { posts: true },
  });

  fs.writeFileSync(
    '/home/user/myproject/relation_result.json',
    JSON.stringify(userWithPosts, null, 2)
  );

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