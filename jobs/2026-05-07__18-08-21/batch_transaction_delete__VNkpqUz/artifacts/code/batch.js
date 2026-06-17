const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Execute operations in a transaction
    await prisma.$transaction([
      // Operation 1: Delete all users whose email ends with @old.com
      prisma.user.deleteMany({
        where: {
          email: {
            endsWith: '@old.com'
          }
        }
      }),
      // Operation 2: Create a new user
      prisma.user.create({
        data: {
          email: 'new@example.com',
          name: 'New User'
        }
      })
    ]);

    console.log('Transaction completed successfully');

    // Query total user count after the transaction
    const userCount = await prisma.user.count();

    // Check if the new user exists
    const newUser = await prisma.user.findUnique({
      where: {
        email: 'new@example.com'
      }
    });

    const result = {
      remaining: userCount,
      newUserExists: newUser !== null
    };

    // Write result to batch_result.json
    fs.writeFileSync('/home/user/myproject/batch_result.json', JSON.stringify(result, null, 2));
    console.log('Result written to batch_result.json:', result);

  } catch (error) {
    console.error('Error during transaction:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();