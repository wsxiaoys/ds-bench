const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

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

  // Create a UserProject record linking them with role: 'admin'
  await prisma.userProject.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: 'admin',
    },
  });

  // Query the user with include: { userProjects: { include: { project: true } } }
  const result = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      userProjects: {
        include: {
          project: true,
        },
      },
    },
  });

  // Write result to explicit_m2m_result.json
  fs.writeFileSync(
    'explicit_m2m_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Result written to explicit_m2m_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
