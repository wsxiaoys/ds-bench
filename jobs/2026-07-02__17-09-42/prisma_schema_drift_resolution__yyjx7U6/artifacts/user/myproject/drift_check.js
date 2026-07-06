const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create a user with bio
    const created = await prisma.user.create({
      data: {
        email: `drift-test-${Date.now()}@example.com`,
        name: 'Drift Test User',
        bio: 'Hello world',
      },
    });

    // Read it back
    const fetched = await prisma.user.findUnique({
      where: { id: created.id },
    });

    const result = {
      created: {
        id: created.id,
        email: created.email,
        name: created.name,
        bio: created.bio,
      },
      fetched: {
        id: fetched.id,
        email: fetched.email,
        name: fetched.name,
        bio: fetched.bio,
      },
    };

    // Write to drift_result.json
    fs.writeFileSync(
      '/home/user/myproject/drift_result.json',
      JSON.stringify(result, null, 2)
    );

    console.log('Drift check completed successfully.');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during drift check:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
