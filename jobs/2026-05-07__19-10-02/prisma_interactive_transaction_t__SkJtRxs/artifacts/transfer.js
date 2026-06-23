const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const sender = await tx.account.findUnique({
      where: { owner: 'alice' },
    });

    if (!sender) {
      throw new Error('Sender account not found');
    }

    if (sender.balance < 50) {
      throw new Error('Insufficient funds');
    }

    await tx.account.update({
      where: { owner: 'alice' },
      data: { balance: { decrement: 50 } },
    });

    await tx.account.update({
      where: { owner: 'bob' },
      data: { balance: { increment: 50 } },
    });
  });

  const [alice, bob] = await Promise.all([
    prisma.account.findUnique({ where: { owner: 'alice' } }),
    prisma.account.findUnique({ where: { owner: 'bob' } }),
  ]);

  const result = {
    alice: alice?.balance ?? null,
    bob: bob?.balance ?? null,
  };

  const fs = require('fs');
  fs.writeFileSync('/home/user/myproject/transfer_result.json', JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
