const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function runUpsert() {
  await prisma.user.upsert({
    where: { email: "upsert@example.com" },
    create: { email: "upsert@example.com", name: "First Run" },
    update: { name: "Second Run" }
  });

  await prisma.user.upsert({
    where: { email: "upsert@example.com" },
    create: { email: "upsert@example.com", name: "First Run" },
    update: { name: "Second Run" }
  });

  const user = await prisma.user.findUnique({
    where: { email: "upsert@example.com" }
  });

  const fs = require("fs");
  fs.writeFileSync("/home/user/myproject/upsert_result.json", JSON.stringify(user, null, 2));
}

runUpsert()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
