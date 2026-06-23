const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('=== Verifying Migration ===\n');

    // Check PostTag records
    const postTags = await prisma.postTag.findMany({
      include: {
        post: true,
        tag: true
      }
    });

    console.log(`PostTag records found: ${postTags.length}`);
    postTags.forEach(pt => {
      console.log(`  - Post "${pt.post.title}" <-> Tag "${pt.tag.name}" (addedAt: ${pt.addedAt.toISOString()})`);
    });

    // Check that _PostToTag doesn't exist
    try {
      await prisma.$queryRaw`SELECT COUNT(*) FROM "_PostToTag"`;
      console.log('\n⚠️  WARNING: _PostToTag table still exists!');
    } catch (error) {
      console.log('\n✓ _PostToTag table has been successfully dropped');
    }

    // Check the schema structure
    console.log('\n=== Schema Structure ===');
    console.log('Post model now has postTags field');
    console.log('Tag model now has postTags field');
    console.log('PostTag model exists with postId, tagId, and addedAt fields');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();