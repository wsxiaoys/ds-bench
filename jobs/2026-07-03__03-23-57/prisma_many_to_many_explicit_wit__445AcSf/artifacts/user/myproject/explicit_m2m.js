const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // Clear any existing records to ensure a repeatable/clean run
  await prisma.userProject.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

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
    where: { email: 'pm@example.com' },
    include: {
      userProjects: {
        include: {
          project: true,
        },
      },
    },
  });

  // Write result to /home/user/myproject/explicit_m2m_result.json
  fs.writeFileSync(
    '/home/user/myproject/explicit_m2m_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Successfully wrote result to explicit_m2m_result.json');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
