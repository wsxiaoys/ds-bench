const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Create a user with bio
    const created = await prisma.user.create({
      data: {
        email: `drift_check_${Date.now()}@example.com`,
        name: 'Drift Check User',
        bio: 'Hello world',
      },
    });

    console.log('Created user:', created);

    // Read it back
    const found = await prisma.user.findUnique({
      where: { id: created.id },
    });

    console.log('Retrieved user:', found);

    const result = {
      success: true,
      created,
      retrieved: found,
      bioVerified: found.bio === 'Hello world',
    };

    const outputPath = path.join(__dirname, 'drift_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Result written to ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
