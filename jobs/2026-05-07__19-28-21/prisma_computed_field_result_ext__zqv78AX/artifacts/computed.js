const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();

  const xprisma = prisma.$extends({
    result: {
      user: {
        fullLabel: {
          needs: { name: true, email: true },
          compute(user) {
            return `${user.name} <${user.email}>`;
          }
        }
      }
    }
  });

  // Create the user first
  try {
    await xprisma.user.create({
      data: {
        email: 'computed@example.com',
        name: 'Computed'
      }
    });
  } catch (e) {
    // ignore if already exists
  }

  // Query the user
  const user = await xprisma.user.findUnique({
    where: { email: 'computed@example.com' }
  });

  // Write the result to computed_result.json
  fs.writeFileSync('/home/user/myproject/computed_result.json', JSON.stringify(user, null, 2));
  
  // Save artifacts
  if (!fs.existsSync('/logs/artifacts')) {
    fs.mkdirSync('/logs/artifacts', { recursive: true });
  }
  fs.writeFileSync('/logs/artifacts/computed.js', fs.readFileSync('/home/user/myproject/computed.js'));
  fs.writeFileSync('/logs/artifacts/computed_result.json', JSON.stringify(user, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});