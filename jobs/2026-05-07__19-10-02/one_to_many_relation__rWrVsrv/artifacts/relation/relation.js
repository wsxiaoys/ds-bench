const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: "author@example.com",
      name: "Author",
      posts: {
        create: [{ title: "Post One" }, { title: "Post Two" }],
      },
    },
  });

  const userWithPosts = await prisma.user.findUnique({
    where: { id: user.id },
    include: { posts: true },
  });

  fs.writeFileSync(
    "relation_result.json",
    JSON.stringify(userWithPosts, null, 2),
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
