const { PrismaClient } = require("@prisma/client");

const xprisma = new PrismaClient().$extends({
  result: {
    user: {
      fullLabel: {
        needs: { name: true, email: true },
        compute(user) {
          return `${user.name} <${user.email}>`;
        },
      },
    },
  },
});

async function main() {
  await xprisma.user.create({
    data: { email: "computed@example.com", name: "Computed" },
  });

  const user = await xprisma.user.findUnique({
    where: { email: "computed@example.com" },
  });

  const fs = require("fs");
  fs.writeFileSync(
    "/home/user/myproject/computed_result.json",
    JSON.stringify(user, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });
