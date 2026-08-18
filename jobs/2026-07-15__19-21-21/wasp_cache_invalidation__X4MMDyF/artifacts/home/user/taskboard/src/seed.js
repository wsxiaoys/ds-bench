// Wasp db seed function, run via `wasp db seed devSeed`.
// Receives Wasp's Prisma Client. It's written to be safe to run repeatedly:
// it clears out any existing Projects/Tasks first, then recreates the
// deterministic initial board described in the task requirements.
export const devSeed = async (prismaClient) => {
  // Delete tasks first since they have a required relation to Project.
  await prismaClient.task.deleteMany()
  await prismaClient.project.deleteMany()

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
  })

  await prismaClient.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [{ title: 'Buy groceries', done: false }],
      },
    },
  })
}
