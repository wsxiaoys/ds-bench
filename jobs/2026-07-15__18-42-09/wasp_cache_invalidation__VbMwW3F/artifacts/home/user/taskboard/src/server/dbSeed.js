/**
 * `devSeed` -- the only Wasp db seed for this app.
 *
 * It is safe to run repeatedly and always leaves the database in exactly this
 * deterministic state:
 *   - project "Work":  tasks "Ship release" (done) and "Write docs" (not done)
 *   - project "Home":  task  "Buy groceries"   (not done)
 *
 * Invoke with: `wasp db seed devSeed`.
 */
export const devSeed = async (prismaClient) => {
  // Clear any prior projects/tasks so the result is deterministic.
  await prismaClient.task.deleteMany({});
  await prismaClient.project.deleteMany({});

  await prismaClient.project.create({
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

  await prismaClient.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [{ title: 'Buy groceries', done: false }],
      },
    },
  });
};