const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const email = `user_${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email: email,
      name: 'Drift Test User',
      bio: 'Hello world'
    }
  });

  // Read it back
  const retrievedUser = await prisma.user.findUnique({
    where: {
      id: user.id
    }
  });

  console.log('Retrieved user:', retrievedUser);

  // Write to /home/user/myproject/drift_result.json
  fs.writeFileSync('/home/user/myproject/drift_result.json', JSON.stringify(retrievedUser, null, 2));
  console.log('Result written to /home/user/myproject/drift_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
