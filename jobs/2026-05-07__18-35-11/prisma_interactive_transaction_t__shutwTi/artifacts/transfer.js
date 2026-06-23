const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // 1. Find the sender account
    const sender = await tx.account.findUnique({ where: { owner: 'alice' } });

    // 2. Check sender has sufficient balance
    if (sender.balance < 50) {
      throw new Error(`Insufficient balance: alice has ${sender.balance}, needs 50`);
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

  // Query both balances after the transaction
  const alice = await prisma.account.findUnique({ where: { owner: 'alice' } });
  const bob   = await prisma.account.findUnique({ where: { owner: 'bob' } });

  const result = { alice: alice.balance, bob: bob.balance };

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/transfer_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Transfer complete:', result);
}

main()
  .catch((err) => {
    console.error('Transfer failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
