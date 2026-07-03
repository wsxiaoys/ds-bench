const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Atomically: (1) delete all users whose email ends with @old.com,
  // and (2) create one new user.
  const [deleteResult, newUser] = await prisma.$transaction([
    prisma.user.deleteMany({
      where: { email: { endsWith: '@old.com' } },
    }),
    prisma.user.create({
      data: { email: 'new@example.com', name: 'New User' },
    }),
  ]);

  console.log(`Deleted ${deleteResult.count} users with @old.com emails.`);
  console.log(`Created new user: ${newUser.email} (${newUser.name}).`);

  // After the transaction, query total user count.
  const remaining = await prisma.user.count();

  // Check whether the new user exists.
  const newUserExists = await prisma.user.findUnique({
    where: { email: 'new@example.com' },
    select: { id: true },
  }) !== null;

  const result = {
    remaining,
    newUserExists,
  };

  const outPath = path.join(__dirname, 'batch_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Result written to ${outPath}:`, result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });