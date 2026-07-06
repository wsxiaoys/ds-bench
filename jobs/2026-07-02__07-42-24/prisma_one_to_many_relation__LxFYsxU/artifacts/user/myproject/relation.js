const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing data to ensure a clean and repeatable run
  try {
    await prisma.post.deleteMany({
      where: {
        author: {
          email: 'author@example.com'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: 'author@example.com'
      }
    });
  } catch (err) {
    // Ignore errors from clean up
  }

  // Create a user with nested posts
  const user = await prisma.user.create({
    data: {
      email: 'author@example.com',
      name: 'Author',
      posts: {
        create: [
          { title: 'Post One' },
          { title: 'Post Two' }
        ]
      }
    }
  });

  // Query the user with posts included
  const result = await prisma.user.findUnique({
    where: {
      email: 'author@example.com'
    },
    include: {
      posts: true
    }
  });

  // Write the result to relation_result.json
  const outputPath = path.join(__dirname, 'relation_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('Successfully wrote result to relation_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
