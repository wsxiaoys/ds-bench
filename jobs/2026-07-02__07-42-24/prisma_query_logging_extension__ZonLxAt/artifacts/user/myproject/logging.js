const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const logFilePath = '/home/user/myproject/query.log';
const resultFilePath = '/home/user/myproject/logging_result.json';

// Clean up existing files to ensure clean run
if (fs.existsSync(logFilePath)) {
  fs.unlinkSync(logFilePath);
}
if (fs.existsSync(resultFilePath)) {
  fs.unlinkSync(resultFilePath);
}

const xprisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        fs.appendFileSync(logFilePath,
          JSON.stringify({ model, operation, args }) + '\n');
        return result;
      }
    }
  }
});

async function main() {
  try {
    // Run 3 queries
    await xprisma.user.findMany();
    await xprisma.user.count();
    await xprisma.user.findFirst();

    // After all queries, read query.log and write the number of logged lines to logging_result.json
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim() !== '');
    const count = lines.length;

    fs.writeFileSync(resultFilePath, JSON.stringify({ loggedQueries: count }));
    console.log(`Successfully logged ${count} queries.`);
  } finally {
    // Disconnect prisma client
    await xprisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
