const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// 1. Define a reusable include config
const userWithPostsArgs = { include: { posts: true } };

// 2. Implement getUserWithPosts(email)
async function getUserWithPosts(email) {
  return await prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs
  });
}

async function main() {
  try {
    // 3. Create a test user with 2 posts (clean up first to ensure clean state)
    const email = 'shape@example.com';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.post.deleteMany({ where: { authorId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    await prisma.user.create({
      data: {
        email,
        name: 'Shape',
        posts: {
          create: [
            { title: 'Shape Post 1' },
            { title: 'Shape Post 2' }
          ]
        }
      }
    });

    // 4. Call getUserWithPosts
    const user = await getUserWithPosts(email);

    // 5. Validate the returned object shape:
    // - Has id, email, name keys
    // - Has posts array with 2 items, each having title
    const hasKeys = user !== null && 'id' in user && 'email' in user && 'name' in user;
    const hasPostsArray = user !== null && Array.isArray(user.posts) && user.posts.length === 2;
    const postsHaveTitle = hasPostsArray && user.posts.every(post => post !== null && 'title' in post);

    const shapeValid = hasKeys && hasPostsArray && postsHaveTitle;
    const postCount = hasPostsArray ? user.posts.length : 0;

    const result = {
      shapeValid,
      postCount
    };

    // 6. Write validation result to /home/user/myproject/payload_result.json
    const outputPath = path.join(__dirname, 'payload_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log('Successfully wrote payload_result.json:', result);

  } catch (error) {
    console.error('Error in payload helper:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
