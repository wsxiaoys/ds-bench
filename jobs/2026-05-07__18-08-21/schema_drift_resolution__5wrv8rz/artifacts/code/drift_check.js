const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting drift check...');

  // Create a user with bio
  console.log('Creating user with bio...');
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      bio: 'Hello world'
    }
  });

  console.log('Created user:', user);

  // Read the user back
  console.log('Reading user back...');
  const retrievedUser = await prisma.user.findUnique({
    where: { id: user.id }
  });

  console.log('Retrieved user:', retrievedUser);

  // Write result to JSON file
  const result = {
    success: true,
    createdUser: user,
    retrievedUser: retrievedUser,
    bioMatch: user.bio === retrievedUser.bio,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('/home/user/myproject/drift_result.json', JSON.stringify(result, null, 2));
  console.log('Result written to drift_result.json');

  // Clean up
  await prisma.user.delete({
    where: { id: user.id }
  });
  console.log('Cleaned up test user');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    const errorResult = {
      success: false,
      error: e.message,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync('/home/user/myproject/drift_result.json', JSON.stringify(errorResult, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });