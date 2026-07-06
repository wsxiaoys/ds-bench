const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Read all entries from _PostToTag via $queryRaw
  const rows = await prisma.$queryRaw`SELECT "A" as postId, "B" as tagId FROM "_PostToTag"`;

  // Create corresponding PostTag records (idempotent - skip if exists)
  for (const row of rows) {
    const existing = await prisma.postTag.findUnique({
      where: { postId_tagId: { postId: row.postId, tagId: row.tagId } },
    });
    if (!existing) {
      await prisma.postTag.create({
        data: { postId: row.postId, tagId: row.tagId },
      });
    }
  }

  // Query PostTag count
  const count = await prisma.postTag.count();

  // Write to result file
  const result = { migratedCount: count };
  fs.writeFileSync(
    '/home/user/myproject/m2m_migrate_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log(`Migrated count: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
