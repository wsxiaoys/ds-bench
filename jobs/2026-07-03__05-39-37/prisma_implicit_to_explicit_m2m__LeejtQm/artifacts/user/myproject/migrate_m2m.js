const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  // 1. Read all entries from the implicit join table `_PostToTag`.
  //    Column "A" references Post.id, column "B" references Tag.id.
  const rows = await prisma.$queryRaw`
    SELECT "A" AS postId, "B" AS tagId FROM "_PostToTag"
  `;

  // Normalize any BigInt values returned by $queryRaw into plain Numbers.
  const entries = rows.map((r) => ({
    postId: Number(r.postId),
    tagId: Number(r.tagId),
  }));

  if (entries.length > 0) {
    // 2. Create corresponding PostTag records (addedAt defaults to now()).
    await prisma.postTag.createMany({
      data: entries,
    });
  }

  // 3. Query the PostTag count and write the result to a JSON file.
  const countAgg = await prisma.postTag.count();
  const migratedCount = Number(countAgg);

  const result = { migratedCount };
  const outPath = path.join(__dirname, "m2m_migrate_result.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log(`Migrated ${migratedCount} PostTag records.`);
  console.log(`Result written to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });