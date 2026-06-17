const { PrismaClient } = require('@prisma/client');

// Create an extended client with computed field
const xprisma = new PrismaClient().$extends({
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

async function main() {
  try {
    // Create a test user
    const user = await xprisma.user.create({
      data: {
        email: 'computed@example.com',
        name: 'Computed'
      }
    });
    console.log('Created user:', user);

    // Query the user with the computed field
    const result = await xprisma.user.findUnique({
      where: { email: 'computed@example.com' }
    });
    console.log('Result with computed field:', result);

    // Write the result to JSON file
    const fs = require('fs');
    fs.writeFileSync(
      '/home/user/myproject/computed_result.json',
      JSON.stringify(result, null, 2)
    );
    console.log('Result saved to computed_result.json');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await xprisma.$disconnect();
  }
}

main();