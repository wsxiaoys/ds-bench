const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function queryUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        name: {
          startsWith: 'A'
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const fs = require('fs');
    fs.writeFileSync('/home/user/myproject/query_result.json', JSON.stringify(users, null, 2));
    
    console.log('Query results saved to query_result.json');
  } catch (error) {
    console.error('Error querying users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryUsers();