const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

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

(async () => {
  await xprisma.user.findMany();
  await xprisma.user.count();
  await xprisma.user.findFirst();

  const logContent = fs.readFileSync('/home/user/myproject/query.log', 'utf-8');
  const lines = logContent
    .split('\n')
    .filter((line) => line.trim().length > 0).length;

  fs.writeFileSync(
    '/home/user/myproject/logging_result.json',
    JSON.stringify({ loggedQueries: lines })
  );

  await xprisma.$disconnect();
})();
