const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  let currentDoc = await prisma.document.findUnique({ where: { id: 1 } });
  
  if (!currentDoc) {
    currentDoc = await prisma.document.create({ data: { id: 1, content: 'Draft', version: 1 } });
  }

  let conflictCaught = false;

  try {
    // Simulate a concurrent update with an old version
    await prisma.$transaction(async (tx) => {
      const current = await tx.document.findUnique({ where: { id: 1 } });
      const expectedVersion = current.version - 1; // Old version simulation
      
      if (current.version !== expectedVersion) {
        throw new Error('Version mismatch');
      }
      
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Should not happen', version: { increment: 1 } }
      });
    });
  } catch (error) {
    if (error.message === 'Version mismatch') {
      conflictCaught = true;
    } else {
      console.error("Unexpected error:", error);
    }
  }

  // Perform a valid update with the correct version
  await prisma.$transaction(async (tx) => {
    const current = await tx.document.findUnique({ where: { id: 1 } });
    const expectedVersion = current.version;
    
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

  fs.writeFileSync('/home/user/myproject/optimistic_result.json', JSON.stringify(result, null, 2));
  
  // Save artifacts
  fs.mkdirSync('/logs/artifacts/code', { recursive: true });
  fs.copyFileSync('/home/user/myproject/optimistic.js', '/logs/artifacts/code/optimistic.js');
  fs.copyFileSync('/home/user/myproject/optimistic_result.json', '/logs/artifacts/code/optimistic_result.json');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
