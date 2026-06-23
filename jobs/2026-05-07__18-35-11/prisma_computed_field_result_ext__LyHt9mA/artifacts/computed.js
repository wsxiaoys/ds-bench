const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const xprisma = new PrismaClient().$extends({
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
  // Create the user (upsert to avoid duplicate errors on re-runs)
  await xprisma.user.upsert({
    where: { email: 'computed@example.com' },
    update: { name: 'Computed' },
    create: { email: 'computed@example.com', name: 'Computed' },
  });

  // Query back with the computed field
  const user = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' },
  });

  console.log('Result:', user);

  // Write result to JSON file
  const outputPath = path.join(__dirname, 'computed_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(user, null, 2));
  console.log(`Written to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });
