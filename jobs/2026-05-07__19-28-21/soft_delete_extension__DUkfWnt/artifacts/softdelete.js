const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const xprisma = prisma.$extends({
    model: {
      user: {
        async softDelete(where) {
          return prisma.user.update({
            where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
    query: {
      user: {
        async findMany({ args, query }) {
          if (!args) args = {};
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
      },
    },
  });

  // Clear existing users just in case
  await prisma.user.deleteMany({});

  // Create a user
  await xprisma.user.create({
    data: { email: 'soft@example.com', name: 'Soft' },
  });

  // Call softDelete
  await xprisma.user.softDelete({ email: 'soft@example.com' });

  // Call xprisma.user.findMany()
  const users = await xprisma.user.findMany();

  const softDeletedExists = users.some(u => u.email === 'soft@example.com');
  const visibleCount = users.length;

  const result = {
    visibleCount,
    softDeletedExists
  };

  fs.writeFileSync('/home/user/myproject/softdelete_result.json', JSON.stringify(result, null, 2));
  
  // Save artifacts
  if (!fs.existsSync('/logs/artifacts')) {
    fs.mkdirSync('/logs/artifacts', { recursive: true });
  }
  fs.writeFileSync('/logs/artifacts/softdelete_result.json', JSON.stringify(result, null, 2));
  fs.writeFileSync('/logs/artifacts/softdelete.js', fs.readFileSync(__filename));
  
  console.log('Done');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
