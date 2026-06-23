const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  try {
    // Perform transaction
    const [deletedInfo, newUser] = await prisma.$transaction([
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

    // Query total user count
    const remainingCount = await prisma.user.count();
    
    // Check if new user exists
    const newUserExists = await prisma.user.findUnique({
      where: { email: 'new@example.com' }
    });

    const result = {
      remaining: remainingCount,
      newUserExists: !!newUserExists
    };

    // Write to output file
    fs.writeFileSync('/home/user/myproject/batch_result.json', JSON.stringify(result, null, 2));
    
    // Save copies to artifacts
    if (!fs.existsSync('/logs/artifacts')) {
      fs.mkdirSync('/logs/artifacts', { recursive: true });
    }
    fs.copyFileSync(__filename, '/logs/artifacts/batch.js');
    fs.copyFileSync('/home/user/myproject/batch_result.json', '/logs/artifacts/batch_result.json');
    
    console.log('Transaction completed successfully.');
  } catch (error) {
    console.error('Error in batch script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();