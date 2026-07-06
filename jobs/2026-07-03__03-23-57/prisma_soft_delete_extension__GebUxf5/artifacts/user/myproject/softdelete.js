const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Create the extended client
const xprisma = prisma.$extends({
  model: {
    user: {
      async softDelete(where) {
        return prisma.user.update({
          where,
          data: { deletedAt: new Date() }
        });
      }
    }
  },
  query: {
    user: {
      async findMany({ model, operation, args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      }
    }
  }
});

async function main() {
  try {
    // 1. Clean up any existing user with this email to ensure clean run
    await prisma.user.deleteMany({
      where: { email: 'soft@example.com' }
    });

    // 2. Create the user
    console.log('Creating user...');
    const user = await xprisma.user.create({
      data: {
        email: 'soft@example.com',
        name: 'Soft'
      }
    });
    console.log('Created user:', user);

    // 3. Call softDelete
    console.log('Soft deleting user...');
    await xprisma.user.softDelete({ email: 'soft@example.com' });

    // 4. Call xprisma.user.findMany()
    console.log('Fetching visible users with extended client...');
    const visibleUsers = await xprisma.user.findMany();
    console.log('Visible users count:', visibleUsers.length);

    // Assert that the soft-deleted user does NOT exist in the visible list
    const softDeletedInVisible = visibleUsers.find(u => u.email === 'soft@example.com');
    if (softDeletedInVisible) {
      throw new Error('Assertion failed: Soft-deleted user is still visible in findMany()!');
    }
    console.log('Assertion passed: Soft-deleted user is NOT visible in findMany().');

    // 5. Check if the soft-deleted user still exists in the database with deletedAt set
    console.log('Verifying user state in database via base client...');
    const dbUser = await prisma.user.findUnique({
      where: { email: 'soft@example.com' }
    });

    const softDeletedExists = !!dbUser && dbUser.deletedAt !== null;
    console.log('User still exists in DB:', !!dbUser);
    console.log('User has deletedAt set:', dbUser ? dbUser.deletedAt : 'N/A');

    // 6. Write results to softdelete_result.json
    const resultPath = path.join(__dirname, 'softdelete_result.json');
    const resultData = {
      visibleCount: visibleUsers.length,
      softDeletedExists: softDeletedExists
    };

    fs.writeFileSync(resultPath, JSON.stringify(resultData, null, 2));
    console.log(`Results written to ${resultPath}:`, resultData);

  } catch (error) {
    console.error('Error during execution:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
