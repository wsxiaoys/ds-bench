const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Extended client with a computed `fullLabel` field on the User model.
const xprisma = new PrismaClient().$extends({
  result: {
    user: {
      fullLabel: {
        needs: { name: true, email: true },
        compute(user) {
          return `${user.name} <${user.email}>`;
        },
      },
    },
  },
});

async function main() {
  // Create a user (upsert so the script is idempotent across runs).
  await xprisma.user.upsert({
    where: { email: 'computed@example.com' },
    update: { name: 'Computed' },
    create: { email: 'computed@example.com', name: 'Computed' },
  });

  // Query the user; the computed `fullLabel` field is added at query time.
  const user = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' },
  });

  console.log('Query result:', user);

  const outPath = path.join(__dirname, 'computed_result.json');
  fs.writeFileSync(outPath, JSON.stringify(user, null, 2));
  console.log('Wrote result to', outPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });