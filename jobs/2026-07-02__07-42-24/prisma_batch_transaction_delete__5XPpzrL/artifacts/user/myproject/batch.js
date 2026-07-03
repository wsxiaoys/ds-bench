const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // Perform the transaction atomically
    await prisma.$transaction([
      prisma.user.deleteMany({
        where: {
          email: {
            endsWith: '@old.com'
          }
        }
      }),
      prisma.user.create({
        data: {
          email: 'new@example.com',
          name: 'New User'
        }
      })
    ]);

    // Query total user count and check if new user exists
    const remaining = await prisma.user.count();
    const newUser = await prisma.user.findUnique({
      where: {
        email: 'new@example.com'
      }
    });
    const newUserExists = newUser !== null;

    // Prepare result object
    const result = {
      remaining,
      newUserExists
    };

    // Write to batch_result.json
    const outputPath = path.join(__dirname, 'batch_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log('Transaction executed successfully. Result written to batch_result.json');
    console.log(result);
  } catch (error) {
    console.error('Error executing transaction:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
