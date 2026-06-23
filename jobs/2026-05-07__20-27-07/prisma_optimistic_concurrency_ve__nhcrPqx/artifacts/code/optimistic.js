const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  let conflictCaught = false;

  // 1. Read current document
  const doc = await prisma.document.findUnique({ where: { id: 1 } });
  console.log('Current document:', doc);

  // 2. Simulate concurrent update with old version
  const oldVersion = doc.version - 1;
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.document.findUnique({ where: { id: 1 } });
      if (current.version !== oldVersion) {
        throw new Error('Version mismatch');
      }
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Should fail', version: { increment: 1 } }
      });
    });
  } catch (error) {
    if (error.message === 'Version mismatch') {
      conflictCaught = true;
      console.log('Conflict caught as expected');
    } else {
      throw error;
    }
  }

  // 3. Perform valid update with correct version
  const expectedVersion = doc.version;
  await prisma.$transaction(async (tx) => {
    const current = await tx.document.findUnique({ where: { id: 1 } });
    if (current.version !== expectedVersion) {
      throw new Error('Version mismatch');
    }
    await tx.document.update({
      where: { id: 1 },
      data: { content: 'Updated', version: { increment: 1 } }
    });
  });

  const finalDoc = await prisma.document.findUnique({ where: { id: 1 } });
  
  const result = {
    conflictCaught,
    finalVersion: finalDoc.version,
    finalContent: finalDoc.content
  };

  fs.writeFileSync('optimistic_result.json', JSON.stringify(result, null, 2));
  console.log('Result written to optimistic_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
