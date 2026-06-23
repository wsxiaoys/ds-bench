const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Step 1: Read the current document (id=1)
  const doc = await prisma.document.findUnique({ where: { id: 1 } });
  console.log('Current document:', doc);

  const currentVersion = doc.version;
  let conflictCaught = false;

  // Step 2: Simulate a concurrent update with an OLD (stale) version
  // Using currentVersion - 1 as the stale/old version
  const staleVersion = currentVersion - 1;
  console.log(`\nAttempting update with stale version ${staleVersion} (expected to fail)...`);

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.document.findUnique({ where: { id: 1 } });
      if (current.version !== staleVersion) {
        throw new Error(
          `Version mismatch: expected ${staleVersion}, found ${current.version}`
        );
      }
      // This line would not be reached because the version check fails above
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Stale update', version: { increment: 1 } },
      });
    });
  } catch (err) {
    console.log('Conflict caught (stale update rejected):', err.message);
    conflictCaught = true;
  }

  // Step 3: Perform a valid update with the correct (current) version
  const expectedVersion = currentVersion;
  console.log(`\nPerforming valid update with correct version ${expectedVersion}...`);

  await prisma.$transaction(async (tx) => {
    const current = await tx.document.findUnique({ where: { id: 1 } });
    if (current.version !== expectedVersion) {
      throw new Error(
        `Version mismatch: expected ${expectedVersion}, found ${current.version}`
      );
    }
    await tx.document.update({
      where: { id: 1 },
      data: { content: 'Updated', version: { increment: 1 } },
    });
  });

  // Step 4: Read back the final state
  const finalDoc = await prisma.document.findUnique({ where: { id: 1 } });
  console.log('\nFinal document:', finalDoc);

  // Step 5: Write result JSON
  const result = {
    conflictCaught,
    finalVersion: finalDoc.version,
    finalContent: finalDoc.content,
  };

  const fs = require('fs');
  fs.writeFileSync(
    '/home/user/myproject/optimistic_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('\nResult written to optimistic_result.json:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
