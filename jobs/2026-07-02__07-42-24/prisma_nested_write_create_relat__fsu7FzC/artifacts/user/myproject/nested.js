const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // Clean up any existing user with this email to make the script idempotent/re-runnable
    try {
      await prisma.post.deleteMany({
        where: { author: { email: 'nested@example.com' } }
      });
      await prisma.user.delete({
        where: { email: 'nested@example.com' }
      });
    } catch (e) {
      // Ignore if user or posts do not exist
    }

    const result = await prisma.user.create({
      data: {
        email: 'nested@example.com',
        name: 'Nested Writer',
        posts: {
          create: [
            { title: 'Nested Post A' },
            { title: 'Nested Post B' }
          ]
        }
      },
      include: { posts: true }
    });

    console.log('Created user and nested posts:', result);

    const outputPath = path.join(__dirname, 'nested_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Result written to ${outputPath}`);
  } catch (error) {
    console.error('Error during execution:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
