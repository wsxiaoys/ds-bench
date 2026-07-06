const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // 1. Initialize/Seed the Document with id=1, content='Draft', version=1
  console.log('Resetting document with id=1 to content="Draft" and version=1...');
  await prisma.document.upsert({
    where: { id: 1 },
    update: { content: 'Draft', version: 1 },
    create: { id: 1, content: 'Draft', version: 1 }
  });

  // 2. Read the current document
  const initialDoc = await prisma.document.findUnique({ where: { id: 1 } });
  console.log('Initial document:', initialDoc);

  let conflictCaught = false;

  // 3. Simulate a concurrent update: attempt to update with an old version (currentVersion - 1)
  const oldVersion = initialDoc.version - 1;
  console.log(`Attempting update with old version (expectedVersion = ${oldVersion})...`);
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.document.findUnique({ where: { id: 1 } });
      if (current.version !== oldVersion) {
        throw new Error('Version mismatch');
      }
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Updated', version: { increment: 1 } }
      });
    });
  } catch (error) {
    console.log('Caught expected conflict/error:', error.message);
    if (error.message === 'Version mismatch') {
      conflictCaught = true;
    } else {
      throw error;
    }
  }

  // 4. Perform a valid update with the correct version
  const expectedVersion = initialDoc.version;
  console.log(`Performing valid update with correct version (expectedVersion = ${expectedVersion})...`);
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

  // 5. Read the final document state
  const finalDoc = await prisma.document.findUnique({ where: { id: 1 } });
  console.log('Final document:', finalDoc);

  // 6. Write to optimistic_result.json
  const result = {
    conflictCaught,
    finalVersion: finalDoc.version,
    finalContent: finalDoc.content
  };

  const outputPath = path.join(__dirname, 'optimistic_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Results written to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error('Error running script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
