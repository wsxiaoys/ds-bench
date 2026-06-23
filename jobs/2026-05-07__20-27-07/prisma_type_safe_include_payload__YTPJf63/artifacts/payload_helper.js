const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

// 1. Define a reusable include config
const userWithPostsArgs = { include: { posts: true } };

// 2. Implement getUserWithPosts(email)
async function getUserWithPosts(email) {
  return await prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

async function main() {
  const email = 'shape@example.com';

  try {
    // 3. Create a test user with 2 posts
    // First, clean up if exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.post.deleteMany({ where: { authorId: existingUser.id } });
      await prisma.user.delete({ where: { email } });
    }

    await prisma.user.create({
      data: {
        email: email,
        name: 'Shape',
        posts: {
          create: [
            { title: 'Shape Post 1' },
            { title: 'Shape Post 2' },
          ],
        },
      },
    });

    // 4. Call getUserWithPosts('shape@example.com')
    const user = await getUserWithPosts(email);

    // 5. Validate the returned object shape
    const hasKeys = user && 'id' in user && 'email' in user && 'name' in user;
    const hasPosts = Array.isArray(user.posts) && user.posts.length === 2;
    const postsHaveTitle = hasPosts && user.posts.every(post => 'title' in post);

    const shapeValid = hasKeys && hasPosts && postsHaveTitle;
    const postCount = hasPosts ? user.posts.length : 0;

    const result = {
      shapeValid,
      postCount
    };

    // 6. Write validation result to /home/user/myproject/payload_result.json
    fs.writeFileSync('/home/user/myproject/payload_result.json', JSON.stringify(result, null, 2));
    console.log('Result written to payload_result.json');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
