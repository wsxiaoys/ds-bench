const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

const userWithPostsArgs = { include: { posts: true } };

async function getUserWithPosts(email) {
  return await prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs
  });
}

async function main() {
  const email = 'shape@example.com';
  
  // Clean up if exists
  await prisma.post.deleteMany({
    where: { author: { email } }
  });
  await prisma.user.deleteMany({
    where: { email }
  });

  // Create test user
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

  const result = await getUserWithPosts(email);

  let shapeValid = false;
  if (
    result &&
    'id' in result &&
    'email' in result &&
    'name' in result &&
    Array.isArray(result.posts) &&
    result.posts.length === 2 &&
    'title' in result.posts[0] &&
    'title' in result.posts[1]
  ) {
    shapeValid = true;
  }

  const output = {
    shapeValid,
    postCount: result ? result.posts.length : 0
  };

  fs.writeFileSync('/home/user/myproject/payload_result.json', JSON.stringify(output, null, 2));
  
  // Copy to artifacts
  if (!fs.existsSync('/logs/artifacts/code')) {
    fs.mkdirSync('/logs/artifacts/code', { recursive: true });
  }
  fs.copyFileSync('/home/user/myproject/payload_helper.js', '/logs/artifacts/code/payload_helper.js');
  fs.copyFileSync('/home/user/myproject/payload_result.json', '/logs/artifacts/code/payload_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });