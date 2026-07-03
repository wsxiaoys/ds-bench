const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const TRANSFER_AMOUNT = 50;

async function main() {
  // Perform the balance transfer inside an interactive transaction so that
  // the balance check and the updates all run within the same transaction.
  // If anything throws, the whole transaction is rolled back REDACTEDmatically.
  await prisma.$transaction(async (tx) => {
    // 1. Find the sender account.
    const sender = await tx.account.findUnique({ where: { owner: 'alice' } });

    if (!sender) {
      throw new Error("Sender account 'alice' not found");
    }

    // 2. Guard: ensure the sender has enough funds.
    if (sender.balance < TRANSFER_AMOUNT) {
      throw new Error(
        `Insufficient funds: alice has ${sender.balance}, needs ${TRANSFER_AMOUNT}`
      );
    }

    // 3. Deduct the amount from the sender.
    await tx.account.update({
      where: { owner: 'alice' },
      data: { balance: { decrement: TRANSFER_AMOUNT } },
    });

    // 4. Add the amount to the receiver.
    await tx.account.update({
      where: { owner: 'bob' },
      data: { balance: { increment: TRANSFER_AMOUNT } },
    });
  });

  // After the transaction commits, query both accounts for the final balances.
  const alice = await prisma.account.findUnique({ where: { owner: 'alice' } });
  const bob = await prisma.account.findUnique({ where: { owner: 'bob' } });

  const result = { alice: alice.balance, bob: bob.balance };

  fs.writeFileSync(
    path.join(__dirname, 'transfer_result.json'),
    JSON.stringify(result, null, 2) + '\n'
  );

  console.log('Transfer complete:', result);
}

main()
  .catch((error) => {
    console.error('Transfer failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });