const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Clean up any leftover rows from previous runs to avoid unique constraint errors.
  await prisma.user.deleteMany({ where: { email: 'test@example.com' } });

  // a. Create a user
  await prisma.user.create({
    data: { email: 'test@example.com', name: 'Test User' },
  });

  // b. Read it back
  const found = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  if (!found) {
    throw new Error('User was not found after create');
  }

  // c. Update the name
  const updated = await prisma.user.update({
    where: { email: 'test@example.com' },
    data: { name: 'Updated User' },
  });
  if (updated.name !== 'Updated User') {
    throw new Error(`Update failed; got name=${updated.name}`);
  }

  // d. Delete the user
  await prisma.user.delete({
    where: { email: 'test@example.com' },
  });

  // e. Confirm deletion
  const afterDelete = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  if (afterDelete !== null) {
    throw new Error('User still exists after delete');
  }

  // Write final status
  const result = { status: 'ok', deleted: true };
  fs.writeFileSync(
    path.join(__dirname, 'crud_result.json'),
    JSON.stringify(result, null, 2) + '\n'
  );
  console.log('CRUD cycle complete:', result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });