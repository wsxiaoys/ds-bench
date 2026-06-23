const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function main() {
  const root = await prisma.category.create({
    data: { name: "Electronics" },
  });

  const child = await prisma.category.create({
    data: { name: "Phones", parentId: root.id },
  });

  await prisma.category.create({
    data: { name: "Smartphones", parentId: child.id },
  });

  const tree = await prisma.category.findFirst({
    where: { name: "Electronics" },
    include: { children: { include: { children: true } } },
  });

  fs.writeFileSync(
    "/home/user/myproject/tree_result.json",
    JSON.stringify(tree, null, 2),
    "utf-8"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
