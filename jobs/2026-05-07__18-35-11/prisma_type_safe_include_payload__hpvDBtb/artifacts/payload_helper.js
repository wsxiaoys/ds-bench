const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Reusable include config (mirrors Prisma.validator pattern)
const userWithPostsArgs = { include: { posts: true } };

/**
 * Fetch a user by email, including their posts.
 * @param {string} email
 */
async function getUserWithPosts(email) {
  return prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

/**
 * Validate that the returned object has the expected shape:
 *  - top-level keys: id, email, name
 *  - posts: array with each item having a title
 */
function validateShape(user, expectedPostCount) {
  if (!user) return false;

  const hasId    = 'id'    in user;
  const hasEmail = 'email' in user;
  const hasName  = 'name'  in user;
  const hasPosts = Array.isArray(user.posts);

  if (!hasId || !hasEmail || !hasName || !hasPosts) return false;
  if (user.posts.length !== expectedPostCount) return false;

  const postsHaveTitle = user.posts.every(
    (post) => typeof post.title === 'string'
  );

  return postsHaveTitle;
}

async function main() {
  // Clean up any existing test user to keep the run idempotent
  await prisma.user.deleteMany({ where: { email: 'shape@example.com' } });

  // Create test user with 2 posts
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

  // Fetch the user back using the helper
  const user = await getUserWithPosts('shape@example.com');

  const postCount = user ? user.posts.length : 0;
  const shapeValid = validateShape(user, 2);

  const result = { shapeValid, postCount };

  const outputPath = path.join(__dirname, 'payload_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log('Validation result:', result);
  console.log('Written to', outputPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
