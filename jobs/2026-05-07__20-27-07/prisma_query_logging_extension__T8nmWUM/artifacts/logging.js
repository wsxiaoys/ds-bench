const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'query.log');
const resultFilePath = path.join(__dirname, 'logging_result.json');

// Ensure log file is empty at start
if (fs.existsSync(logFilePath)) {
  fs.unlinkSync(logFilePath);
}

const prisma = new PrismaClient();

const xprisma = prisma.$extends({
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
    console.log('Running queries...');
    await xprisma.user.findMany();
    await xprisma.user.count();
    await xprisma.user.findFirst();
    console.log('Queries completed.');

    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.trim().split('\n').filter(line => line.length > 0);
    const loggedQueries = lines.length;

    fs.writeFileSync(resultFilePath, JSON.stringify({ loggedQueries }, null, 2));
    console.log(`Results written to ${resultFilePath}: { "loggedQueries": ${loggedQueries} }`);
  } catch (error) {
    console.error('Error running queries:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
