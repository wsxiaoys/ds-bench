const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.user.deleteMany({
      where: {
        email: {
          endsWith: "@old.com",
        },
      },
    }),
    prisma.user.create({
      data: {
        email: "new@example.com",
        name: "New User",
      },
    }),
  ]);

  const remaining = await prisma.user.count();
  const newUser = await prisma.user.findUnique({
    where: {
      email: "new@example.com",
    },
  });

  const result = {
    remaining,
    newUserExists: Boolean(newUser),
  };

  fs.writeFileSync("/home/user/myproject/batch_result.json", JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
