const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Extend the Prisma client to add soft delete support on the User model
const xprisma = prisma.$extends({
  model: {
    user: {
      // Custom softDelete method: mark a user as deleted by setting deletedAt
      async softDelete(where) {
        // Get the underlying client to call update
        return prisma.user.update({
          where,
          data: { deletedAt: new Date() },
        });
      },

      // Override findMany to exclude soft-deleted records by default
      async findMany({ where, ...rest } = {}) {
        const mergedWhere = { deletedAt: null, ...(where || {}) };
        // If caller passes deletedAt: { not: null } or similar, preserve that explicit intent
        if (where && Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
          return prisma.user.findMany({ where, ...rest });
        }
        return prisma.user.findMany({ where: mergedWhere, ...rest });
      },
    },
  },
});

async function main() {
  try {
    // Ensure a clean slate for the test user (upsert handles re-runs)
    const existing = await prisma.user.findUnique({
      where: { email: 'soft@example.com' },
    });
    if (existing) {
      await prisma.user.delete({ where: { email: 'soft@example.com' } });
    }

    // Create the test user
    await prisma.user.create({
      data: { email: 'soft@example.com', name: 'Soft' },
    });

    // Soft-delete the user via the extended client
    await xprisma.user.softDelete({ email: 'soft@example.com' });

    // findMany should NOT include the soft-deleted user
    const visibleUsers = await xprisma.user.findMany();

    // Verify with the underlying client that the row still exists with deletedAt set
    const rawRow = await prisma.user.findUnique({
      where: { email: 'soft@example.com' },
    });
    const softDeletedExists = !!(rawRow && rawRow.deletedAt !== null);

    const result = {
      visibleCount: visibleUsers.length,
      softDeletedExists,
    };

    const outPath = path.join(__dirname, 'softdelete_result.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

    if (visibleUsers.some((u) => u.email === 'soft@example.com')) {
      throw new Error(
        'Assertion failed: soft-deleted user was returned by findMany'
      );
    }
    if (!softDeletedExists) {
      throw new Error(
        'Assertion failed: soft-deleted row should still exist with deletedAt set'
      );
    }

    console.log('Soft delete verified. Result:', result);
    console.log('Wrote result to', outPath);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
