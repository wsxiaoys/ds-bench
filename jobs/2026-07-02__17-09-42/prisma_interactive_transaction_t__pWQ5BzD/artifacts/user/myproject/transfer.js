const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // 1. Find the sender account
    const sender = await tx.account.findUnique({
      where: { owner: 'alice' },
    });

    if (!sender) {
      throw new Error('Sender account (alice) not found');
    }

    // 2. Check balance
    if (sender.balance < 50) {
      throw new Error('Insufficient balance: sender has less than 50');
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

  // After the transaction, query both balances
  const alice = await prisma.account.findUnique({
    where: { owner: 'alice' },
  });
  const bob = await prisma.account.findUnique({
    where: { owner: 'bob' },
  });

  const result = {
    alice: alice.balance,
    bob: bob.balance,
  };

  fs.writeFileSync(
    '/home/user/myproject/transfer_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Transfer complete. Result:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });