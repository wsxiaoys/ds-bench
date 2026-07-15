// Database seed named `devSeed` (declared in main.wasp under app.db.seeds).
//
// It is safe to run repeatedly: it clears any existing tasks and projects
// first, then recreates the deterministic initial board state:
//   - Project "Work" with tasks "Ship release" (done) and "Write docs" (not done)
//   - Project "Home" with task "Buy groceries" (not done)
export const devSeed = async (prisma) => {
  // Delete tasks first to respect the foreign key relation.
  await prisma.task.deleteMany({})
  await prisma.project.deleteMany({})

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
  })

  await prisma.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [{ title: 'Buy groceries', done: false }],
      },
    },
  })
}