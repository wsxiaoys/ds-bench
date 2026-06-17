const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const sender = await tx.account.findUnique({
        where: { owner: 'alice' },
      });

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

    fs.writeFileSync(
      '/home/user/myproject/transfer_result.json',
      JSON.stringify({ alice: alice.balance, bob: bob.balance })
    );

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
