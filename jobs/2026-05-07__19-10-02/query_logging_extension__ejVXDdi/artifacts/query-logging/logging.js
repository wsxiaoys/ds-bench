const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const xprisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const result = await query(args);
        fs.appendFileSync(
          '/home/user/myproject/query.log',
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

  const logContents = fs.readFileSync('/home/user/myproject/query.log', 'utf8');
  const loggedQueries = logContents
    .split('\n')
    .filter((line) => line.trim().length > 0).length;

  fs.writeFileSync(
    '/home/user/myproject/logging_result.json',
    JSON.stringify({ loggedQueries }, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });
