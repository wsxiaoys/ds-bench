const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Perform the interactive transaction
    await prisma.$transaction(async (tx) => {
      // 1. Find the sender account (owner: 'alice')
      const sender = await tx.account.findUnique({
        where: { owner: 'alice' },
      });

      if (!sender) {
        throw new Error("Sender 'alice' not found");
      }

      // 2. If sender.balance < 50, throw an error
      if (sender.balance < 50) {
        throw new Error("Insufficient funds");
      }

      // 3. Deduct 50 from sender
      await tx.account.update({
        where: { owner: 'alice' },
        data: { balance: { decrement: 50 } },
      });

      // 4. Add 50 to receiver
      await tx.account.update({
        where: { owner: 'bob' },
        data: { balance: { increment: 50 } },
      });
    });

    console.log('Transaction completed successfully.');

  } catch (error) {
    console.error('Transaction failed:', error.message);
  } finally {
    // Query both balances after transaction (regardless of success/failure, though here we expect success)
    const alice = await prisma.account.findUnique({ where: { owner: 'alice' } });
    const bob = await prisma.account.findUnique({ where: { owner: 'bob' } });

    const result = {
      alice: alice ? alice.balance : null,
      bob: bob ? bob.balance : null,
    };

    // Write to transfer_result.json
    fs.writeFileSync(
      path.join(__dirname, 'transfer_result.json'),
      JSON.stringify(result, null, 2)
    );

    console.log('Result written to transfer_result.json:', result);

    await prisma.$disconnect();
  }
}

main();
