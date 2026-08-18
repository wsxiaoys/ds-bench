export const devSeed = async (prisma) => {
  // Clear any prior tasks and projects first
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});

  await prisma.project.create({
    data: {
      name: 'Work',
      tasks: {
        create: [
          { title: 'Ship release', done: true },
          { title: 'Write docs', done: false }
        ]
      }
    }
  });

  await prisma.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [
          { title: 'Buy groceries', done: false }
        ]
      }
    }
  });
};
