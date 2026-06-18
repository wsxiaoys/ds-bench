const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Step 1: Read all entries from the implicit join table via $queryRaw
  // In the _PostToTag table: A = postId, B = tagId
  const implicitRows = await prisma.$queryRaw`SELECT "A" AS postId, "B" AS tagId FROM "_PostToTag"`;

  console.log(`Found ${implicitRows.length} rows in _PostToTag:`, implicitRows);

  // Step 2: Create corresponding PostTag records
  for (const row of implicitRows) {
    await prisma.postTag.upsert({
      where: {
        postId_tagId: {
          postId: row.postId,
          tagId: row.tagId,
        },
      },
      update: {},
      create: {
        postId: row.postId,
        tagId: row.tagId,
      },
    });
  }

  console.log(`Upserted ${implicitRows.length} PostTag records.`);

  // Step 3: Query the PostTag count
  const migratedCount = await prisma.postTag.count();

  console.log(`PostTag count: ${migratedCount}`);

  // Step 4: Write result to m2m_migrate_result.json
  const result = { migratedCount };
  const outputPath = path.join(__dirname, 'm2m_migrate_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`Result written to ${outputPath}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Migration failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
