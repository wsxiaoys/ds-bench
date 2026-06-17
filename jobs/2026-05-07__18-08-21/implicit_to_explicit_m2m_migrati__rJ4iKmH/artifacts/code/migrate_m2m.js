const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrateM2M() {
  try {
    console.log('Starting M2M migration...');

    // Try to read from the old _PostToTag table
    let oldPostToTags = [];
    try {
      oldPostToTags = await prisma.$queryRaw`SELECT * FROM "_PostToTag"`;
      console.log(`Found ${oldPostToTags.length} entries in _PostToTag`);
    } catch (error) {
      console.log('_PostToTag table does not exist or is not accessible. This is expected if migration was already applied.');
    }

    // Create PostTag records for any entries found
    if (oldPostToTags.length > 0) {
      console.log('Migrating data to PostTag...');
      
      for (const entry of oldPostToTags) {
        // The old table uses columns A (postId) and B (tagId)
        await prisma.postTag.upsert({
          where: {
            postId_tagId: {
              postId: entry.A,
              tagId: entry.B
            }
          },
          update: {},
          create: {
            postId: entry.A,
            tagId: entry.B,
            addedAt: new Date()
          }
        });
      }
      
      console.log(`Migrated ${oldPostToTags.length} records to PostTag`);
    }

    // Query the final PostTag count
    const postTagCount = await prisma.postTag.count();
    console.log(`Total PostTag records: ${postTagCount}`);

    // Write result to JSON file
    const result = {
      migratedCount: postTagCount
    };

    const resultPath = '/home/user/myproject/m2m_migrate_result.json';
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`Result written to ${resultPath}`);

    return result;
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateM2M()
  .then((result) => {
    console.log('Migration completed successfully:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });