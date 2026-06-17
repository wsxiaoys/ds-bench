const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Create an extended Prisma Client with soft delete support on the User model
const xprisma = prisma.$extends({
  model: {
    user: {
      // Custom softDelete method: sets deletedAt to current timestamp
      async softDelete(where) {
        return prisma.user.update({
          where,
          data: { deletedAt: new Date() },
        });
      },

      // Override findMany to exclude soft-deleted records by default
      async findMany(args) {
        const mergedArgs = {
          ...args,
          where: {
            deletedAt: null,
            ...(args && args.where ? args.where : {}),
          },
        };
        return prisma.user.findMany(mergedArgs);
      },
    },
  },
});

async function main() {
  // Clean up any existing test user to ensure idempotency
  await prisma.user.deleteMany({ where: { email: 'soft@example.com' } });

  // Create a new user
  await prisma.user.create({
    data: { email: 'soft@example.com', name: 'Soft' },
  });

  // Soft-delete the user
  await xprisma.user.softDelete({ email: 'soft@example.com' });

  // Find all visible (non-soft-deleted) users
  const visibleUsers = await xprisma.user.findMany();

  const softDeletedExists = visibleUsers.some(
    (u) => u.email === 'soft@example.com'
  );

  console.log('Visible users count:', visibleUsers.length);
  console.log('Soft-deleted user in results:', softDeletedExists);

  // Assert the soft-deleted user is NOT in the results
  if (softDeletedExists) {
    throw new Error('Assertion failed: soft-deleted user should NOT appear in findMany results');
  }

  const result = {
    visibleCount: visibleUsers.length,
    softDeletedExists,
  };

  // Write output file
  const outputPath = path.join(__dirname, 'softdelete_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Result written to', outputPath);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
