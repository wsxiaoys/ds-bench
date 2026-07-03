const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // First upsert: creates the record (name: 'First Run')
  const first = await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('First upsert result:', first);

  // Second upsert: updates the existing record (name: 'Second Run')
  const second = await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' },
  });
  console.log('Second upsert result:', second);

  // Confirm the persisted state after the second upsert
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' },
  });

  const outputPath = path.join(__dirname, 'upsert_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(user, null, 2));
  console.log('Wrote result to', outputPath);
  console.log('Result:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });