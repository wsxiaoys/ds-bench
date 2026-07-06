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
  await xprisma.user.create({
    data: { email: 'computed@example.com', name: 'Computed' }
  });

  const user = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' }
  });

  fs.writeFileSync('/home/user/myproject/computed_result.json', JSON.stringify(user, null, 2));
  console.log('Result written to computed_result.json');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await xprisma.$disconnect();
  });
