export const devSeed = async (prismaClient: any) => {
  // Clear any prior projects/tasks first so the result is deterministic.
  await prismaClient.task.deleteMany({});
  await prismaClient.project.deleteMany({});

  // A project named `Work` containing two tasks titled `Ship release` (done) and `Write docs` (not done)
  const work = await prismaClient.project.create({
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

  // A project named `Home` containing one task titled `Buy groceries` (not done)
  const home = await prismaClient.project.create({
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
