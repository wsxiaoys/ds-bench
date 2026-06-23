const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // a. Create a user
    console.log('Creating user...');
    const createdUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    });
    console.log('Created user:', createdUser);

    // b. Read it back
    console.log('\nReading user...');
    const readUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    console.log('Read user:', readUser);

    // c. Update the name to 'Updated User'
    console.log('\nUpdating user...');
    const updatedUser = await prisma.user.update({
      where: { email: 'test@example.com' },
      data: { name: 'Updated User' }
    });
    console.log('Updated user:', updatedUser);

    // d. Delete the user
    console.log('\nDeleting user...');
    const deletedUser = await prisma.user.delete({
      where: { email: 'test@example.com' }
    });
    console.log('Deleted user:', deletedUser);

    // e. Confirm deletion by calling findUnique again
    console.log('\nConfirming deletion...');
    const deletedCheck = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    // Assert the result is null
    const isDeleted = deletedCheck === null;
    console.log('User after deletion check:', deletedCheck);
    console.log('Deletion confirmed:', isDeleted);

    // Write the final status to crud_result.json
    const result = {
      status: 'ok',
      deleted: isDeleted
    };

    fs.writeFileSync(
      path.join(__dirname, 'crud_result.json'),
      JSON.stringify(result, null, 2)
    );
    console.log('\nResult written to crud_result.json:', result);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();