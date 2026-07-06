const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const xprisma = prisma.$extends({
  result: {
    user: {
      fullLabel: {
        needs: { name: true, email: true },
        compute(user) {
          return `${user.name} <${user.email}>`;
        }
      }
    }
  }
});

async function main() {
  // Create user (using upsert to make the script idempotent)
  await xprisma.user.upsert({
    where: { email: 'computed@example.com' },
    update: { name: 'Computed' },
    create: { email: 'computed@example.com', name: 'Computed' }
  });

  // Query it with findUnique
  const result = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' }
  });

  console.log('Queried user with computed field:', result);

  // Write the result (including computed field) to computed_result.json
  fs.writeFileSync(
    path.join(__dirname, 'computed_result.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
