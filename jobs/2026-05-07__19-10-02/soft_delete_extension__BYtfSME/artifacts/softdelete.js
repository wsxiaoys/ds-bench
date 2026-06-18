const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const xprisma = prisma.$extends({
  model: {
    user: {
      async softDelete(where) {
        return prisma.user.update({
          where,
          data: {
            deletedAt: new Date(),
          },
        });
      },
      async findMany(args = {}) {
        const where = {
          deletedAt: null,
          ...(args.where ?? {}),
        };

        return prisma.user.findMany({
          ...args,
          where,
        });
      },
    },
  },
});

async function main() {
  const email = "soft@example.com";
  const name = "Soft";

  await prisma.user.upsert({
    where: { email },
    create: { email, name },
    update: { name, deletedAt: null },
  });

  await xprisma.user.softDelete({ email });

  const users = await xprisma.user.findMany();
  const softDeletedExists = users.some((user) => user.email === email);

  const result = {
    visibleCount: users.length,
    softDeletedExists,
  };

  const outputPath = path.join(__dirname, "softdelete_result.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
