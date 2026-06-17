const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Transaction to delete users with @old.com and create a new user
    await prisma.$transaction([
      prisma.user.deleteMany({
        where: {
          email: {
            endsWith: '@old.com',
          },
        },
      }),
      prisma.user.create({
        data: {
          email: 'new@example.com',
          name: 'New User',
        },
      }),
    ]);

    // 2. Query total user count
    const remainingCount = await prisma.user.count();

    // 3. Check if new user exists
    const newUser = await prisma.user.findUnique({
      where: {
        email: 'new@example.com',
      },
    });

    const result = {
      remaining: remainingCount,
      newUserExists: !!newUser,
    };

    // 4. Write result to batch_result.json
    fs.writeFileSync(
      path.join(__dirname, 'batch_result.json'),
      JSON.stringify(result, null, 2)
    );

    console.log('Transaction completed successfully.');
  } catch (error) {
    console.error('Error during transaction:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
