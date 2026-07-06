const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Use prisma.$queryRaw with a tagged template literal to count users
    const countResult = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM User`;
    
    // 2. Use prisma.$executeRaw to update all users' names to uppercase
    await prisma.$executeRaw`UPDATE User SET name = UPPER(name)`;
    
    // 3. Query all users after the update with prisma.user.findMany()
    const users = await prisma.user.findMany();
    
    // 4. Write to /home/user/myproject/rawsql_result.json
    const result = {
      countResult,
      users
    };
    
    // Use a custom replacer to handle BigInt serialization safely
    const jsonString = JSON.stringify(result, (key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    }, 2);
    
    fs.writeFileSync(path.join(__dirname, 'rawsql_result.json'), jsonString);
    console.log('Successfully executed raw SQL queries and wrote results.');
  } catch (error) {
    console.error('Error executing raw SQL script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
