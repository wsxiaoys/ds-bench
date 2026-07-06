const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Read the current document
  const initial = await prisma.document.findUnique({ where: { id: 1 } });
  if (!initial) {
    throw new Error('Document with id=1 not found');
  }
  const currentVersion = initial.version;
  const staleVersion = currentVersion - 1; // simulate another process holding an old version

  // Simulate a concurrent update with an old version.
  // We attempt the update; it should fail because no row matches the stale version.
  // We also wrap the optimistic-update in an interactive transaction to detect the conflict.
  let conflictCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction to get the actual current version.
      const current = await tx.document.findUnique({ where: { id: 1 } });

      // Simulate concurrent update with an old (stale) version.
      // The expected version passed in by the "other" writer is staleVersion.
      if (current.version !== staleVersion) {
        throw new Error('Version mismatch (concurrent update detected)');
      }

      // Should not reach here because the version check fails first.
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Updated', version: { increment: 1 } }
      });
    });
  } catch (err) {
    conflictCaught = true;
    console.log(`Conflict caught: ${err.message}`);
  }

  // Now perform a valid update with the correct version.
  let finalDocument;
  await prisma.$transaction(async (tx) => {
    const current = await tx.document.findUnique({ where: { id: 1 } });
    const expectedVersion = currentVersion;
    if (current.version !== expectedVersion) throw new Error('Version mismatch');
    finalDocument = await tx.document.update({
      where: { id: 1 },
      data: { content: 'Updated', version: { increment: 1 } }
    });
  });

  const result = {
    conflictCaught,
    finalVersion: finalDocument.version,
    finalContent: finalDocument.content
  };

  fs.writeFileSync(
    '/home/user/myproject/optimistic_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
