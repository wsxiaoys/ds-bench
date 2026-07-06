// payload_helper.js
// Type-safe include payload helper for Prisma User/Post queries.

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 1. Reusable include config (mirrors Prisma.validator<Prisma.UserInclude>()({ posts: true }))
const userWithPostsArgs = { include: { posts: true } };

// 2. Typed query helper that spreads the reusable include config.
async function getUserWithPosts(email) {
  return prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

async function main() {
  const testEmail = 'shape@example.com';

  // 3. Reset the test user and posts to guarantee a deterministic shape
  //    (clean up any posts first to satisfy the FK from Post -> User).
  await prisma.post.deleteMany({ where: { author: { email: testEmail } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });

  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Shape',
      posts: {
        create: [
          { title: 'Shape Post 1' },
          { title: 'Shape Post 2' },
        ],
      },
    },
  });

  // 4. Fetch the user with the reusable include payload.
  const userWithPosts = await getUserWithPosts(testEmail);

  // 5. Validate the returned object shape at runtime.
  const requiredUserKeys = ['id', 'email', 'name'];
  const hasUserKeys =
    userWithPosts !== null &&
    requiredUserKeys.every((key) => Object.prototype.hasOwnProperty.call(userWithPosts, key));

  const posts = (userWithPosts && userWithPosts.posts) || null;
  const postCount = Array.isArray(posts) ? posts.length : 0;
  const allPostsHaveTitle =
    Array.isArray(posts) && posts.every((p) => p && typeof p.title === 'string');

  const shapeValid =
    hasUserKeys && Array.isArray(posts) && postCount === 2 && allPostsHaveTitle;

  // 6. Persist the validation result.
  const result = { shapeValid, postCount };
  const outPath = path.join(__dirname, 'payload_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  console.log('Validation result:', result);
  console.log(`Wrote ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
