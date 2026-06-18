const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Define a reusable include config
const userWithPostsArgs = {
  include: {
    posts: true
  }
};

// Implement getUserWithPosts function
async function getUserWithPosts(email) {
  return await prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs
  });
}

// Main function to test the payload helper
async function main() {
  try {
    // Clean up existing test data if any
    await prisma.post.deleteMany({
      where: {
        author: {
          email: 'shape@example.com'
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: 'shape@example.com'
      }
    });

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'shape@example.com',
        name: 'Shape',
        posts: {
          create: [
            { title: 'Shape Post 1' },
            { title: 'Shape Post 2' }
          ]
        }
      }
    });

    console.log('Created test user:', user);

    // Call getUserWithPosts
    const userWithPosts = await getUserWithPosts('shape@example.com');

    console.log('Fetched user with posts:', userWithPosts);

    // Validate the returned object shape
    let shapeValid = false;
    let postCount = 0;

    if (userWithPosts) {
      // Check if user has id, email, name keys
      const hasId = 'id' in userWithPosts;
      const hasEmail = 'email' in userWithPosts;
      const hasName = 'name' in userWithPosts;

      // Check if user has posts array
      const hasPosts = 'posts' in userWithPosts && Array.isArray(userWithPosts.posts);

      // Check posts count and each post has title
      if (hasPosts) {
        postCount = userWithPosts.posts.length;
        const allPostsHaveTitle = userWithPosts.posts.every(post => 'title' in post);

        shapeValid = hasId && hasEmail && hasName && hasPosts && allPostsHaveTitle;
      } else {
        shapeValid = hasId && hasEmail && hasName;
      }

      console.log('Validation results:');
      console.log('- Has id:', hasId);
      console.log('- Has email:', hasEmail);
      console.log('- Has name:', hasName);
      console.log('- Has posts:', hasPosts);
      console.log('- Post count:', postCount);
      console.log('- Shape valid:', shapeValid);
    }

    // Write validation result to payload_result.json
    const result = {
      shapeValid,
      postCount
    };

    const fs = require('fs');
    fs.writeFileSync(
      '/home/user/myproject/payload_result.json',
      JSON.stringify(result, null, 2)
    );

    console.log('\nResult written to payload_result.json:', result);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main();