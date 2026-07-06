const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  // 1. Read all entries from _PostToTag in the backup database via $queryRaw
  process.env.DATABASE_URL = 'file:./dev.db.bak';
  const prismaBak = new PrismaClient();
  
  console.log('Reading entries from backup database _PostToTag...');
  const entries = await prismaBak.$queryRaw`SELECT * FROM _PostToTag`;
  await prismaBak.$disconnect();
  
  console.log(`Successfully read ${entries.length} entries from backup.`);

  // 2. Connect to the active database (which has the new schema)
  delete process.env.DATABASE_URL; // Revert to standard DATABASE_URL
  const prismaActive = new PrismaClient();
  
  console.log('Migrating entries to PostTag table in active database...');
  for (const entry of entries) {
    const postId = Number(entry.A);
    const tagId = Number(entry.B);
    
    await prismaActive.postTag.create({
      data: {
        postId,
        tagId,
      }
    });
  }
  
  // 3. Query PostTag count
  const count = await prismaActive.postTag.count();
  console.log(`Migration complete. Total PostTag records: ${count}`);
  
  // 4. Write to /home/user/myproject/m2m_migrate_result.json
  const result = { migratedCount: count };
  fs.writeFileSync('/home/user/myproject/m2m_migrate_result.json', JSON.stringify(result, null, 2));
  console.log('Successfully wrote m2m_migrate_result.json');
  
  await prismaActive.$disconnect();
}

main().catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
