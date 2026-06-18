const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Read all entries from _PostToTag
  const entries = await prisma.$queryRaw`SELECT * FROM "_PostToTag"`;
  
  console.log(`Found ${entries.length} entries in _PostToTag`);
  
  // Create corresponding PostTag records
  for (const entry of entries) {
    // _PostToTag uses A and B. Usually A is Post id, B is Tag id.
    // Let's verify this. In schema, Post is first alphabetically? Yes, Post then Tag.
    // So A=Post, B=Tag.
    await prisma.postTag.create({
      data: {
        postId: entry.A,
        tagId: entry.B
      }
    });
  }
  
  // Query PostTag count
  const migratedCount = await prisma.postTag.count();
  
  // Write to m2m_migrate_result.json
  const result = { migratedCount };
  fs.writeFileSync('/home/user/myproject/m2m_migrate_result.json', JSON.stringify(result, null, 2));
  
  console.log(`Migrated ${migratedCount} records successfully.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });