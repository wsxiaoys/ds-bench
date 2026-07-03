const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const LOG_FILE = '/home/user/myproject/query.log';
const RESULT_FILE = '/home/user/myproject/logging_result.json';

// Clear any previous log file so the count reflects only this run
if (fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

const xprisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        fs.appendFileSync(
          LOG_FILE,
          JSON.stringify({ model, operation, args }) + '\n'
        );
        return result;
      },
    },
  },
});

async function main() {
  await xprisma.user.findMany();
  await xprisma.user.count();
  await xprisma.user.findFirst();

  const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
  const loggedQueries = logContent
    .split('\n')
    .filter((line) => line.trim() !== '').length;

  fs.writeFileSync(
    RESULT_FILE,
    JSON.stringify({ loggedQueries }, null, 2)
  );

  console.log(`Logged ${loggedQueries} queries to ${LOG_FILE}`);
  console.log(`Result written to ${RESULT_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });