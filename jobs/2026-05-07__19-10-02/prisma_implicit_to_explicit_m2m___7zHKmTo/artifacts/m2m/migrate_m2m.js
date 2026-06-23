const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const OUTPUT_PATH = path.join(__dirname, "m2m_migrate_result.json");
const SNAPSHOT_URL = `file:${path.join(__dirname, "prisma/dev.db.snapshot")}`;

async function fetchPostTagRows() {
  const sources = [
    { label: "current", client: prisma },
    {
      label: "snapshot",
      client: new PrismaClient({
        datasources: { db: { url: SNAPSHOT_URL } },
      }),
    },
  ];

  for (const source of sources) {
    const hasTable = await source.client.$queryRaw`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = '_PostToTag'
    `;

    if (hasTable.length > 0) {
      const rows = await source.client.$queryRaw`
        SELECT "A" AS "postId", "B" AS "tagId"
        FROM "_PostToTag"
      `;

      if (source.label === "snapshot") {
        await source.client.$disconnect();
      }

      return rows;
    }

    if (source.label === "snapshot") {
      await source.client.$disconnect();
    }
  }

  return [];
}

async function main() {
  const rows = await fetchPostTagRows();

  if (rows.length > 0) {
    await prisma.postTag.createMany({
      data: rows.map((row) => ({
        postId: row.postId,
        tagId: row.tagId,
      })),
    });
  }

  const migratedCount = await prisma.postTag.count();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ migratedCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
