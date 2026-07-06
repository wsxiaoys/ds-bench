const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Extended client implementing soft delete behavior on the User model.
const xprisma = prisma.$extends({
  model: {
    user: {
      // Soft delete: instead of removing the record, stamp it with deletedAt.
      async softDelete(where) {
        return prisma.user.update({
          where,
          data: { deletedAt: new Date() },
        });
      },

      // Override findMany to exclude soft-deleted records by default.
      async findMany(args) {
        const incomingWhere = (args && args.where) ? args.where : {};
        return prisma.user.findMany({
          ...args,
          where: {
            ...incomingWhere,
            deletedAt: null,
          },
        });
      },
    },
  },
});

async function main() {
  // Clean slate: ensure the target user does not already exist so the
  // unique email constraint is not violated on repeated runs.
  await prisma.user.deleteMany({ where: { email: 'soft@example.com' } });

  // Create the user we will soft-delete.
  await prisma.user.create({
    data: { email: 'soft@example.com', name: 'Soft' },
  });

  // Soft-delete the user (sets deletedAt instead of removing the row).
  await xprisma.user.softDelete({ email: 'soft@example.com' });

  // findMany via the extended client should exclude soft-deleted records.
  const visible = await xprisma.user.findMany();

  // Check directly against the base client whether the soft-deleted row
  // still physically exists in the database.
  const allRows = await prisma.user.findMany();
  const softDeletedExists = allRows.some(
    (u) => u.email === 'soft@example.com' && u.deletedAt !== null,
  );

  const result = {
    visibleCount: visible.length,
    softDeletedExists,
  };

  fs.writeFileSync(
    path.join(__dirname, 'softdelete_result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );

  console.log('Result:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });