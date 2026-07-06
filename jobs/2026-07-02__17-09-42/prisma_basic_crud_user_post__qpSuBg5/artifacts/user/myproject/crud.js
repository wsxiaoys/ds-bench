const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // a. Create
  const created = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });
  console.log('Created:', created);

  // b. Read
  const found = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  if (!found) {
    throw new Error('User not found after creation');
  }
  console.log('Read:', found);

  // c. Update
  const updated = await prisma.user.update({
    where: { email: 'test@example.com' },
    data: { name: 'Updated User' },
  });
  console.log('Updated:', updated);

  // d. Delete
  const deleted = await prisma.user.delete({
    where: { email: 'test@example.com' },
  });
  console.log('Deleted:', deleted);

  // e. Confirm deletion
  const after = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  if (after !== null) {
    throw new Error(`Expected null after deletion, got: ${JSON.stringify(after)}`);
  }
  console.log('Confirmed deletion: result is null');

  const result = { status: 'ok', deleted: true };
  const outPath = path.join(__dirname, 'crud_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Wrote result to', outPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
