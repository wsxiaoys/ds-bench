const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: 'pm@example.com',
      name: 'PM'
    }
  });

  const project = await prisma.project.create({
    data: {
      name: 'Alpha'
    }
  });

  await prisma.userProject.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: 'admin'
    }
  });

  const result = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      userProjects: {
        include: {
          project: true
        }
      }
    }
  });

  fs.writeFileSync('/home/user/myproject/explicit_m2m_result.json', JSON.stringify(result, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });