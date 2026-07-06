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

  // Create a UserProject join record linking them with a role
  await prisma.userProject.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: 'admin',
    },
  });

  // Query the user including the join records and their projects
  const result = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      userProjects: {
        include: { project: true },
      },
    },
  });

  // Write result to JSON file
  const outPath = path.join(__dirname, 'explicit_m2m_result.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Result written to', outPath);
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