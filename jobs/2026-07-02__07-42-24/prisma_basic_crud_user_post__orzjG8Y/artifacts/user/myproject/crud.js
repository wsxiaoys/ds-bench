const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Optional cleanup in case the record already exists from previous runs/tests
  try {
    await prisma.user.delete({
      where: { email: 'test@example.com' }
    });
  } catch (e) {
    // Ignore error if user doesn't exist
  }

  // a. Create a user: { email: 'test@example.com', name: 'Test User' }
  const createdUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });
  console.log('Created User:', createdUser);

  // b. Read it back with prisma.user.findUnique({ where: { email: 'test@example.com' } })
  const readUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('Read User:', readUser);
  if (!readUser) {
    throw new Error('User was not found after creation');
  }

  // c. Update the name to 'Updated User' using prisma.user.update
  const updatedUser = await prisma.user.update({
    where: { email: 'test@example.com' },
    data: { name: 'Updated User' },
  });
  console.log('Updated User:', updatedUser);

  // d. Delete the user using prisma.user.delete
  const deletedUser = await prisma.user.delete({
    where: { email: 'test@example.com' },
  });
  console.log('Deleted User:', deletedUser);

  // e. Confirm deletion by calling findUnique again and asserting the result is null
  const confirmedDeletedUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });
  console.log('Confirmed Deleted User:', confirmedDeletedUser);
  if (confirmedDeletedUser !== null) {
    throw new Error('User was not deleted successfully');
  }

  // 3. Write the final status to /home/user/myproject/crud_result.json as { "status": "ok", "deleted": true }
  const resultPath = path.join(__dirname, 'crud_result.json');
  fs.writeFileSync(resultPath, JSON.stringify({ status: 'ok', deleted: true }, null, 2));
  console.log('Result written to', resultPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
