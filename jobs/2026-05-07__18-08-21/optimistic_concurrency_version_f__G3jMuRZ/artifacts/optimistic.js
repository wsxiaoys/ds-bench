const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  let conflictCaught = false;
  let finalVersion = null;
  let finalContent = null;

  try {
    // Step 1: Read the current document (id=1)
    const current = await prisma.document.findUnique({
      where: { id: 1 }
    });

    if (!current) {
      throw new Error('Document with id=1 not found');
    }

    console.log('Current document:', { id: current.id, content: current.content, version: current.version });

    // Step 2: Simulate a concurrent update with an old version (should fail)
    // We'll use currentVersion - 1 to simulate a version mismatch
    const oldVersion = current.version - 1;
    console.log(`Attempting update with old version ${oldVersion} (current is ${current.version})...`);

    try {
      await prisma.$transaction(async (tx) => {
        const docInTx = await tx.document.findUnique({ where: { id: 1 } });
        
        // Check if version matches the expected old version
        if (docInTx.version !== oldVersion) {
          throw new Error('Version mismatch');
        }

        // This should never be reached due to version mismatch
        await tx.document.update({
          where: { id: 1 },
          data: { content: 'This should not happen', version: { increment: 1 } }
        });
      });
    } catch (error) {
      if (error.message === 'Version mismatch') {
        console.log('✓ Conflict caught: Version mismatch detected');
        conflictCaught = true;
      } else {
        throw error;
      }
    }

    // Step 3: Perform a valid update with the correct version
    console.log('Performing valid update with correct version...');
    const expectedVersion = current.version;
    
    await prisma.$transaction(async (tx) => {
      const docInTx = await tx.document.findUnique({ where: { id: 1 } });
      
      // Check if version matches the expected version
      if (docInTx.version !== expectedVersion) {
        throw new Error('Version mismatch');
      }

      // Update with correct version
      await tx.document.update({
        where: { id: 1 },
        data: { content: 'Updated', version: { increment: 1 } }
      });
    });

    // Step 4: Read the final document state
    const finalDoc = await prisma.document.findUnique({
      where: { id: 1 }
    });

    finalVersion = finalDoc.version;
    finalContent = finalDoc.content;
    
    console.log('Final document:', { id: finalDoc.id, content: finalDoc.content, version: finalDoc.version });

    // Step 5: Write results to optimistic_result.json
    const result = {
      conflictCaught: conflictCaught,
      finalVersion: finalVersion,
      finalContent: finalContent
    };

    fs.writeFileSync('/home/user/myproject/optimistic_result.json', JSON.stringify(result, null, 2));
    console.log('✓ Results written to optimistic_result.json');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();