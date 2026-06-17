const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
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

  try {
    await xprisma.user.findMany();
  } catch (e) {
    console.error(e);
  }
  
  try {
    await xprisma.user.count();
  } catch (e) {
    console.error(e);
  }
  
  try {
    await xprisma.user.findFirst();
  } catch (e) {
    console.error(e);
  }

  const logContent = fs.readFileSync('/home/user/myproject/query.log', 'utf8');
  const lines = logContent.trim().split('\n').filter(line => line.length > 0);
  
  fs.writeFileSync('/home/user/myproject/logging_result.json', JSON.stringify({ loggedQueries: lines.length }));
  
  // Save artifacts
  if (!fs.existsSync('/logs/artifacts')) {
    fs.mkdirSync('/logs/artifacts', { recursive: true });
  }
  fs.copyFileSync('/home/user/myproject/logging.js', '/logs/artifacts/logging.js');
  if (fs.existsSync('/home/user/myproject/query.log')) {
    fs.copyFileSync('/home/user/myproject/query.log', '/logs/artifacts/query.log');
  }
  fs.copyFileSync('/home/user/myproject/logging_result.json', '/logs/artifacts/logging_result.json');
}

main().catch(console.error).finally(() => process.exit(0));
