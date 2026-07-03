const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const sender = await tx.account.findUnique({ where: { owner: 'alice' } });
    if (!sender || sender.balance < 50) {
      throw new Error('Insufficient balance');
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

  const alice = await prisma.account.findUnique({ where: { owner: 'alice' } });
  const bob = await prisma.account.findUnique({ where: { owner: 'bob' } });

  const result = { alice: alice.balance, bob: bob.balance };
  fs.writeFileSync(
    path.join(__dirname, 'transfer_result.json'),
    JSON.stringify(result)
  );
  console.log(JSON.stringify(result));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
