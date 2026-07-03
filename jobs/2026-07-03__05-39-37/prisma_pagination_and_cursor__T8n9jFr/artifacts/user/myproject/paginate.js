const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: `file:${path.join(__dirname, "prisma", "dev.db")}`,
  });

  try {
    // Page 1: fetch the first 5 users ordered by id ascending
    const page1 = await prisma.user.findMany({
      take: 5,
      orderBy: { id: "asc" },
    });

    // Page 2: fetch the next 5 users using the last id of page 1 as the cursor.
    // `skip: 1` is required so the cursor record itself is not included again.
    const page2 = await prisma.user.findMany({
      take: 5,
      skip: 1,
      cursor: { id: page1[page1.length - 1].id },
      orderBy: { id: "asc" },
    });

    const result = { page1, page2 };

    fs.writeFileSync(
      path.join(__dirname, "paginate_result.json"),
      JSON.stringify(result, null, 2)
    );

    console.log("Page 1:", JSON.stringify(page1, null, 2));
    console.log("Page 2:", JSON.stringify(page2, null, 2));
    console.log("Results written to paginate_result.json");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});