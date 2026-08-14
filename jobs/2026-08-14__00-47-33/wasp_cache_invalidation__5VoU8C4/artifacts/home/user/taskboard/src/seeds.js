export const devSeed = async (prismaClient) => {
  // Clear any prior projects/tasks
  await prismaClient.task.deleteMany({});
  await prismaClient.project.deleteMany({});

  // Seed Work project
  await prismaClient.project.create({
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

  // Seed Home project
  await prismaClient.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [
          { title: 'Buy groceries', done: false }
        ]
      }
    }
  });

  console.log('Database successfully seeded with devSeed!');
};
