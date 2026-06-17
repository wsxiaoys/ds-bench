const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('All users in database:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name || 'N/A'}`);
    });
    console.log(`Total users: ${users.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();