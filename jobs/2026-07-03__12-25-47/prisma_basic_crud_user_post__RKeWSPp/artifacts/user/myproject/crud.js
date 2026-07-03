const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // a. Create
  await prisma.user.create({
    data: { email: 'test@example.com', name: 'Test User' },
  });

  // b. Read
  const found = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('Found:', found);

  // c. Update
  const updated = await prisma.user.update({
    where: { email: 'test@example.com' },
    data: { name: 'Updated User' },
  });
  console.log('Updated:', updated);

  // d. Delete
  await prisma.user.delete({
    where: { email: 'test@example.com' },
  });

  // e. Confirm deletion
  const afterDelete = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('After delete:', afterDelete);
  if (afterDelete !== null) {
    throw new Error('Expected user to be deleted');
  }

  fs.writeFileSync(
    '/home/user/myproject/crud_result.json',
    JSON.stringify({ status: 'ok', deleted: true })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
