const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // 1. Read the current document (id=1)
  const current = await prisma.document.findUnique({ where: { id: 1 } });
  if (!current) {
    throw new Error('Document with id=1 not found');
  }

  const currentVersion = current.version;
  // An old/stale version that a concurrent writer might still hold.
  const staleVersion = currentVersion - 1;

  let conflictCaught = false;

  // 2. Simulate a concurrent update: attempt to update with an OLD version
  //    inside an interactive transaction. The conditional updateMany only
  //    affects rows whose version still matches the stale value. Since the
  //    real version is newer, zero rows are updated and we throw to roll
  //    the transaction back.
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: 1, version: staleVersion },
        data: { content: 'Stale Update', version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new Error('Version mismatch - optimistic concurrency conflict');
      }
    });
    // If we reach here, no conflict was detected (unexpected).
    conflictCaught = false;
  } catch (err) {
    // The transaction threw because the version did not match.
    conflictCaught = true;
    console.log('Conflict caught:', err.message);
  }

  // 3. Perform a valid update with the CORRECT version inside a transaction.
  const expectedVersion = currentVersion;
  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id: 1 } });
    if (doc.version !== expectedVersion) {
      throw new Error('Version mismatch');
    }
    await tx.document.update({
      where: { id: 1 },
      data: { content: 'Updated', version: { increment: 1 } },
    });
  });

  // 4. Read the final state and write the result file.
  const final = await prisma.document.findUnique({ where: { id: 1 } });

  const result = {
    conflictCaught,
    finalVersion: final.version,
    finalContent: final.content,
  };

  fs.writeFileSync(
    '/home/user/myproject/optimistic_result.json',
    JSON.stringify(result, null, 2) + '\n',
  );

  console.log('Result written to optimistic_result.json:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });