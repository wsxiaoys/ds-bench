const fs = require('fs');
const path = require('path');

// The SQLite database lives at prisma/dev.db. The .env defines a relative
// path of `file:./dev.db`, which resolves against the current working
// directory. Point it at the correct file so the query finds the seeded data.
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { name: { startsWith: 'A' } },
    orderBy: { name: 'asc' },
  });

  const outPath = path.join(__dirname, 'query_result.json');
  fs.writeFileSync(outPath, JSON.stringify(users, null, 2));
  console.log(`Wrote ${users.length} user(s) to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });