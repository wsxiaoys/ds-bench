const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

const xprisma = prisma.$extends({
  model: {
    user: {
      async softDelete(where) {
        return prisma.user.update({
          where,
          data: { deletedAt: new Date() },
        });
      },
      async findMany(args = {}) {
        const newArgs = {
          ...args,
          where: {
            ...args.where,
            deletedAt: null,
          },
        };
        return prisma.user.findMany(newArgs);
      },
    },
  },
});

async function main() {
  try {
    // Cleanup
    await prisma.user.deleteMany({ where: { email: 'soft@example.com' } });

    // Create a user
    await xprisma.user.create({
      data: { email: 'soft@example.com', name: 'Soft' },
    });
    console.log('User created');

    // Call softDelete
    await xprisma.user.softDelete({ email: 'soft@example.com' });
    console.log('User soft-deleted');

    // Call findMany
    const users = await xprisma.user.findMany();
    console.log('Visible users:', users.length);

    // Verify
    const softDeletedUser = await prisma.user.findUnique({
      where: { email: 'soft@example.com' },
    });
    
    const softDeletedExists = softDeletedUser !== null && softDeletedUser.deletedAt !== null;
    const visibleCount = users.length;

    const result = {
      visibleCount,
      softDeletedExists,
    };

    fs.writeFileSync('softdelete_result.json', JSON.stringify(result, null, 2));
    console.log('Result written to softdelete_result.json:', result);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
