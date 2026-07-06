const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const xprisma = prisma.$extends({
  model: {
    user: {
      async softDelete(where) {
        return await prisma.user.update({ where, data: { deletedAt: new Date() } });
      },
      async findMany({ where, ...rest } = {}) {
        return await prisma.user.findMany({
          ...rest,
          where: { ...(where || {}), deletedAt: null },
        });
      },
    },
  },
});

(async () => {
  try {
    // Clean up any existing record so the script is repeatable
    await prisma.user.deleteMany({ where: { email: 'soft@example.com' } });

    // Create a user
    await xprisma.user.create({
      data: { email: 'soft@example.com', name: 'Soft' },
    });

    // Soft delete the user
    const deleted = await xprisma.user.softDelete({ email: 'soft@example.com' });
    console.log('Soft-deleted:', deleted);

    // findMany should not include the soft-deleted user
    const visible = await xprisma.user.findMany();
    console.log('Visible users:', visible);

    const visibleCount = visible.length;
    const softDeletedActualExists = Boolean(
      await prisma.user.findFirst({ where: { email: 'soft@example.com' } })
    );

    const result = {
      visibleCount,
      softDeletedExists: softDeletedActualExists,
    };

    fs.writeFileSync('/home/user/myproject/softdelete_result.json', JSON.stringify(result, null, 2));
    console.log('Wrote:', result);
  } catch (e) {
    console.error('Error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
