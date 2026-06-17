const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Create extended client with soft delete functionality
const xprisma = prisma.$extends({
  model: {
    user: {
      // Custom softDelete method
      async softDelete(where) {
        return await prisma.user.update({
          where,
          data: { deletedAt: new Date() }
        });
      },
      
      // Override findMany to exclude soft-deleted records by default
      async findMany(args) {
        // Merge the default where clause with any provided args
        const mergedArgs = {
          ...args,
          where: {
            deletedAt: null,
            ...(args?.where || {})
          }
        };
        return await prisma.user.findMany(mergedArgs);
      }
    }
  }
});

async function main() {
  try {
    // Clean up any existing test user
    await prisma.user.deleteMany({
      where: { email: 'soft@example.com' }
    });

    // Create a test user
    const createdUser = await xprisma.user.create({
      data: {
        email: 'soft@example.com',
        name: 'Soft'
      }
    });
    console.log('Created user:', createdUser);

    // Soft delete the user
    await xprisma.user.softDelete({ email: 'soft@example.com' });
    console.log('Soft deleted user');

    // Find all users - should NOT include the soft-deleted user
    const visibleUsers = await xprisma.user.findMany();
    console.log('Visible users:', visibleUsers);

    // Check if the soft-deleted user still exists in the database
    const softDeletedUser = await prisma.user.findUnique({
      where: { email: 'soft@example.com' }
    });

    // Write results to JSON file
    const result = {
      visibleCount: visibleUsers.length,
      softDeletedExists: softDeletedUser !== null
    };

    require('fs').writeFileSync(
      '/home/user/myproject/softdelete_result.json',
      JSON.stringify(result, null, 2)
    );

    console.log('Result:', result);

    // Verify the assertion
    if (visibleUsers.length === 0 && softDeletedUser !== null) {
      console.log('✓ Test passed: Soft-deleted user is not visible in findMany()');
    } else {
      console.error('✗ Test failed: Expected 0 visible users, got', visibleUsers.length);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();