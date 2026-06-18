const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
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

  // Create or update the user
  await xprisma.user.upsert({
    where: { email: 'computed@example.com' },
    update: { name: 'Computed' },
    create: { email: 'computed@example.com', name: 'Computed' },
  });

  // Query it
  const user = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' }
  });

  console.log('User with computed field:', user);

  // Write the result to computed_result.json
  fs.writeFileSync(
    '/home/user/myproject/computed_result.json',
    JSON.stringify(user, null, 2)
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
