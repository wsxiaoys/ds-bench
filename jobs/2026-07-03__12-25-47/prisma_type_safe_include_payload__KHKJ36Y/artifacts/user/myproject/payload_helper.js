const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

// 1. Reusable include config
const userWithPostsArgs = { include: { posts: true } };

// 2. getUserWithPosts function
async function getUserWithPosts(email) {
  return prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

async function main() {
  // 3. Create test user with 2 posts
  await prisma.post.deleteMany({ where: { author: { email: 'shape@example.com' } } });
  await prisma.user.deleteMany({ where: { email: 'shape@example.com' } });

  await prisma.user.create({
    data: {
      email: 'shape@example.com',
      name: 'Shape',
      posts: {
        create: [
          { title: 'Shape Post 1' },
          { title: 'Shape Post 2' },
        ],
      },
    },
  });

  // 4. Call getUserWithPosts
  const user = await getUserWithPosts('shape@example.com');
  console.log('Fetched user:', JSON.stringify(user, null, 2));

  // 5. Validate shape
  const hasId = user && 'id' in user;
  const hasEmail = user && 'email' in user;
  const hasName = user && 'name' in user;
  const hasPosts = user && Array.isArray(user.posts);
  const postCount = hasPosts ? user.posts.length : 0;
  const eachPostHasTitle = hasPosts ? user.posts.every(p => 'title' in p) : false;

  const shapeValid = Boolean(hasId && hasEmail && hasName && hasPosts && postCount === 2 && eachPostHasTitle);

  const result = {
    shapeValid,
    postCount,
  };

  // 6. Write result to JSON
  fs.writeFileSync('/home/user/myproject/payload_result.json', JSON.stringify(result));
  console.log('Result:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
