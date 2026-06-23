const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Find the sender account (owner: 'alice')
      const sender = await tx.account.findUnique({
        where: { owner: 'alice' },
      });

      if (!sender) {
        throw new Error('Sender "alice" not found');
      }

      // 2. If sender.balance < 50, throw an error
      if (sender.balance < 50) {
        throw new Error('Insufficient balance');
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

    // After the transaction, query both balances
    const alice = await prisma.account.findUnique({ where: { owner: 'alice' } });
    const bob = await prisma.account.findUnique({ where: { owner: 'bob' } });

    const result = {
      alice: alice.balance,
      bob: bob.balance,
    };

    // Write to transfer_result.json
    fs.writeFileSync(
      path.join(__dirname, 'transfer_result.json'),
      JSON.stringify(result, null, 2)
    );

    console.log('Result written to transfer_result.json:', result);
  } catch (error) {
    console.error('Transaction failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
