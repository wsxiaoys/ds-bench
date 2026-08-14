export const devSeed = async (prisma) => {
  // Clear any prior projects/tasks first to be deterministic
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});

  // Create project Work
  await prisma.project.create({
    data: {
      name: 'Work',
      tasks: {
        create: [
          { title: 'Ship release', done: true },
          { title: 'Write docs', done: false },
        ],
      },
    },
  });

  // Create project Home
  await prisma.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [
          { title: 'Buy groceries', done: false },
        ],
      },
    },
  });

  console.log('Database seeded successfully!');
};
