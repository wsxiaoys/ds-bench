const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing record first to ensure the demo is clean and reproducible
  try {
    await prisma.user.delete({
      where: { email: 'upsert@example.com' }
    });
  } catch (e) {
    // Ignore error if user doesn't exist
  }

  // First run: creates the record because it doesn't exist yet
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' }
  });

  // Second run: updates the record to 'Second Run' because it now exists
  await prisma.user.upsert({
    where: { email: 'upsert@example.com' },
    create: { email: 'upsert@example.com', name: 'First Run' },
    update: { name: 'Second Run' }
  });

  // Find unique record
  const user = await prisma.user.findUnique({
    where: { email: 'upsert@example.com' }
  });

  // Write resulting user object as JSON to /home/user/myproject/upsert_result.json
  const outputPath = path.join(__dirname, 'upsert_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(user, null, 2), 'utf8');

  console.log('Result saved to upsert_result.json:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
