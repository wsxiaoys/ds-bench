// migrate_m2m.js
// Migrates data from the implicit join table `_PostToTag` to the explicit
// `PostTag` join model. Reads entries via $queryRaw, creates corresponding
// PostTag records, then writes the resulting PostTag count to
// m2m_migrate_result.json.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // 1. Read all entries from the implicit M2M join table.
  const oldRows = await prisma.$queryRaw`SELECT A, B FROM _PostToTag`;

  // 2. Create corresponding PostTag records. Use createMany (skipDuplicates
  //    makes the script idempotent) and a per-row fallback to handle any
  //    potential constraint issues gracefully.
  for (const row of oldRows) {
    const postId = row.A;
    const tagId = row.B;
    try {
      await prisma.postTag.create({
        data: { postId, tagId },
      });
    } catch (err) {
      // If the (postId, tagId) pair already exists, skip it.
      if (err.code === 'P2002') {
        continue;
      }
      throw err;
    }
  }

  // 3. Query PostTag count and write the result to the JSON file.
  const migratedCount = await prisma.postTag.count();

  const result = { migratedCount };
  const outPath = path.join(__dirname, 'm2m_migrate_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`Migrated ${migratedCount} PostTag records.`);
  console.log(`Wrote result to ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
