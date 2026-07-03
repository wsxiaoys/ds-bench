const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

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
  await xprisma.user.upsert({
    where: { email: 'computed@example.com' },
    update: {},
    create: { email: 'computed@example.com', name: 'Computed' }
  });

  const result = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' }
  });

  fs.writeFileSync(
    '/home/user/myproject/computed_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });