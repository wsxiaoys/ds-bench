const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // First run
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' }
  });

  // Second run
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' }
  });

  // Find unique
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' }
  });

  // Write to JSON
  fs.writeFileSync('/home/user/myproject/upsert_result.json', JSON.stringify(user, null, 2));
  
  // Save to artifacts
  fs.mkdirSync('/logs/artifacts/code', { recursive: true });
  fs.copyFileSync('/home/user/myproject/upsert.js', '/logs/artifacts/code/upsert.js');
  fs.copyFileSync('/home/user/myproject/upsert_result.json', '/logs/artifacts/code/upsert_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
