const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const current = await prisma.document.findUnique({ where: { id: 1 } });
  if (!current) {
    throw new Error('Document not found');
  }

  let conflictCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: 1, version: current.version - 1 },
        data: { content: 'Concurrent update', version: { increment: 1 } },
      });

      if (result.count === 0) {
        throw new Error('Version mismatch');
      }
    });
  } catch (error) {
    conflictCaught = true;
  }

  const expectedVersion = current.version;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.document.findUnique({ where: { id: 1 } });
    if (!fresh) {
      throw new Error('Document not found');
    }
    if (fresh.version !== expectedVersion) {
      throw new Error('Version mismatch');
    }

    await tx.document.update({
      where: { id: 1 },
      data: { content: 'Updated', version: { increment: 1 } },
    });
  });

  const finalDoc = await prisma.document.findUnique({ where: { id: 1 } });

  const result = {
    conflictCaught,
    finalVersion: finalDoc ? finalDoc.version : null,
    finalContent: finalDoc ? finalDoc.content : null,
  };

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/optimistic_result.json',
    JSON.stringify(result, null, 2)
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
