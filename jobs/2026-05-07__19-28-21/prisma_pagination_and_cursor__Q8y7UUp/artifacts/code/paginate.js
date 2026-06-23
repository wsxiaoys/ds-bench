const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Page 1
  const page1 = await prisma.user.findMany({
    take: 5,
    orderBy: { id: 'asc' }
  });

  // Page 2
  const lastUserInPage1 = page1[page1.length - 1];
  
  const page2 = await prisma.user.findMany({
    take: 5,
    skip: 1, // Skip the cursor
    cursor: { id: lastUserInPage1.id },
    orderBy: { id: 'asc' }
  });

  const result = { page1, page2 };
  
  fs.writeFileSync('/home/user/myproject/paginate_result.json', JSON.stringify(result, null, 2));
  
  // Save artifacts
  if (!fs.existsSync('/logs/artifacts/code')) {
    fs.mkdirSync('/logs/artifacts/code', { recursive: true });
  }
  fs.copyFileSync('/home/user/myproject/paginate.js', '/logs/artifacts/code/paginate.js');
  fs.copyFileSync('/home/user/myproject/paginate_result.json', '/logs/artifacts/code/paginate_result.json');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
