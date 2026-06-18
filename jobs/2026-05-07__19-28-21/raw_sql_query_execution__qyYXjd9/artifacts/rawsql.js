const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Count users using $queryRaw
    const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
    
    // Update users' names to uppercase using $executeRaw
    await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
    
    // Query all users after update
    const users = await prisma.user.findMany();
    
    // Write results to rawsql_result.json
    // Handle BigInt serialization for the count result
    const output = {
      countResult,
      users
    };
    
    fs.writeFileSync(
      '/home/user/myproject/rawsql_result.json', 
      JSON.stringify(output, (key, value) => 
        typeof value === 'bigint' ? Number(value) : value
      , 2)
    );
    
    console.log('Script executed successfully');
  } catch (error) {
    console.error('Error executing script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();