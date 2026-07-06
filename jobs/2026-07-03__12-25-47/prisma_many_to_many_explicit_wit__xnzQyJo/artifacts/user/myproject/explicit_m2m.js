const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  // Clean up any existing data
  await prisma.userProject.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.project.deleteMany({});

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

  // Create a UserProject record linking them with role 'admin'
  const userProject = await prisma.userProject.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: 'admin',
    },
  });

  // Query the user with the nested includes
  const result = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      userProjects: {
        include: { project: true },
      },
    },
  });

  // Write result to JSON file
  fs.writeFileSync(
    '/home/user/myproject/explicit_m2m_result.json',
    JSON.stringify(result, null, 2)
  );

  console.log('Done. Result written to explicit_m2m_result.json');
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
