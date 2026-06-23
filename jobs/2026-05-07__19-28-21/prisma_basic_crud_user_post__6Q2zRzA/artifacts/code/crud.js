const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Create a user
    const createdUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });
    console.log('Created user:', createdUser);

    // 2. Read it back
    const readUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    console.log('Read user:', readUser);

    // 3. Update the name
    const updatedUser = await prisma.user.update({
      where: { email: 'test@example.com' },
      data: { name: 'Updated User' },
    });
    console.log('Updated user:', updatedUser);

    // 4. Delete the user
    const deletedUser = await prisma.user.delete({
      where: { email: 'test@example.com' },
    });
    console.log('Deleted user:', deletedUser);

    // 5. Confirm deletion
    const confirmedNull = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    console.log('Confirmed null:', confirmedNull);

    if (confirmedNull === null) {
      fs.writeFileSync('/home/user/myproject/crud_result.json', JSON.stringify({ status: 'ok', deleted: true }));
      console.log('Success! Result written to crud_result.json');
    } else {
      console.error('Deletion failed');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();