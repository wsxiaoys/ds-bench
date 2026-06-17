const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;

const prisma = new PrismaClient();

async function main() {
  try {
    // Seed accounts if they don't exist
    console.log('Checking existing accounts...');
    const existingAccounts = await prisma.account.findMany();
    
    if (existingAccounts.length === 0) {
      console.log('Seeding accounts...');
      await prisma.account.create({
        data: { owner: 'alice', balance: 100 }
      });
      await prisma.account.create({
        data: { owner: 'bob', balance: 50 }
      });
      console.log('Accounts seeded: Alice (100), Bob (50)');
    } else {
      console.log('Existing accounts:', existingAccounts);
    }

    // Perform transfer using interactive transaction
    console.log('\nStarting transfer transaction...');
    await prisma.$transaction(async (tx) => {
      // Find the sender account
      const sender = await tx.account.findUnique({
        where: { owner: 'alice' }
      });

      if (!sender) {
        throw new Error('Sender account not found');
      }

      // Check if sender has sufficient balance
      if (sender.balance < 50) {
        throw new Error('Insufficient balance: Alice has ' + sender.balance + ', needs 50');
      }

      console.log(`Alice's balance before transfer: ${sender.balance}`);

      // Deduct 50 from sender
      await tx.account.update({
        where: { owner: 'alice' },
        data: { balance: { decrement: 50 } }
      });

      // Add 50 to receiver
      await tx.account.update({
        where: { owner: 'bob' },
        data: { balance: { increment: 50 } }
      });

      console.log('Transfer completed successfully');
    });

    // Query both balances after transaction
    console.log('\nQuerying final balances...');
    const aliceAccount = await prisma.account.findUnique({
      where: { owner: 'alice' }
    });

    const bobAccount = await prisma.account.findUnique({
      where: { owner: 'bob' }
    });

    const result = {
      alice: aliceAccount.balance,
      bob: bobAccount.balance
    };

    console.log('Final balances:', result);

    // Write result to JSON file
    await fs.writeFile(
      '/home/user/myproject/transfer_result.json',
      JSON.stringify(result, null, 2)
    );

    console.log('\nResult written to transfer_result.json');

  } catch (error) {
    console.error('Error during transfer:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();