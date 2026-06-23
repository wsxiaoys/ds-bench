const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Create an extended client with query logging
const xprisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        fs.appendFileSync('/home/user/myproject/query.log',
          JSON.stringify({ model, operation, args }) + '\n');
        return result;
      }
    }
  }
});

async function runQueries() {
  try {
    // Run 3 queries
    await xprisma.user.findMany();
    await xprisma.user.count();
    await xprisma.user.findFirst();
    
    // Read the log file and count lines
    const logContent = fs.readFileSync('/home/user/myproject/query.log', 'utf8');
    const lines = logContent.trim().split('\n').filter(line => line.length > 0);
    const loggedQueries = lines.length;
    
    // Write result to JSON file
    fs.writeFileSync('/home/user/myproject/logging_result.json',
      JSON.stringify({ loggedQueries }, null, 2));
    
    console.log(`Logged ${loggedQueries} queries successfully`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await xprisma.$disconnect();
  }
}

runQueries();