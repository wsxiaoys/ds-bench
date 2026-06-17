const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  // Create a user
  const user = await prisma.user.create({
    data: {
      email: 'pm@example.com',
      name: 'PM',
    },
  });

  // Create a project
  const project = await prisma.project.create({
    data: {
      name: 'Alpha',
    },
  });

  // Create the UserProject join record with role metadata
  await prisma.userProject.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: 'admin',
    },
  });

  // Query the user including userProjects and nested project
  const result = await prisma.user.findUnique({
    where: { email: 'pm@example.com' },
    include: {
      userProjects: {
        include: {
          project: true,
        },
      },
    },
  });

  // Write result to JSON file
  const outputPath = path.join(__dirname, 'explicit_m2m_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Result written to', outputPath);
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
