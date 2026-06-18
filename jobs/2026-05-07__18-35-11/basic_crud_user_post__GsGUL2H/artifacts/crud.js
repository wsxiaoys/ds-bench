'use strict';

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // a. Create
  const created = await prisma.user.create({
    data: { email: 'test@example.com', name: 'Test User' },
  });
  console.log('Created:', created);

  // b. Read
  const found = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('Read:', found);
  if (!found) throw new Error('User not found after creation');

  // c. Update
  const updated = await prisma.user.update({
    where: { email: 'test@example.com' },
    data: { name: 'Updated User' },
  });
  console.log('Updated:', updated);
  if (updated.name !== 'Updated User') throw new Error('Name was not updated');

  // d. Delete
  const deleted = await prisma.user.delete({
    where: { email: 'test@example.com' },
  });
  console.log('Deleted:', deleted);

  // e. Confirm deletion
  const afterDelete = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('After delete (should be null):', afterDelete);
  if (afterDelete !== null) throw new Error('User still exists after deletion');

  // Write result
  const result = { status: 'ok', deleted: true };
  fs.writeFileSync(
    path.join(__dirname, 'crud_result.json'),
    JSON.stringify(result, null, 2)
  );
  console.log('Result written to crud_result.json');
}

main()
  .catch((err) => {
    console.error('CRUD script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
