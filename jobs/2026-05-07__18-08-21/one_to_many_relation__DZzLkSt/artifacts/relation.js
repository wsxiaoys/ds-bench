const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Create a user with two posts using nested create
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

  console.log('Created user:', user);

  // Query the user with posts included
  const userWithPosts = await prisma.user.findUnique({
    where: {
      email: 'author@example.com'
    },
    include: {
      posts: true
    }
  });

  console.log('User with posts:', userWithPosts);

  // Write the result to JSON file
  fs.writeFileSync('/home/user/myproject/relation_result.json', JSON.stringify(userWithPosts, null, 2));

  console.log('Result written to relation_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });