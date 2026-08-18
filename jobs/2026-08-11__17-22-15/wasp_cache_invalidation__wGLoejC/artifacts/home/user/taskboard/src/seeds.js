export const devSeed = async (prisma) => {
  // Clear existing projects/tasks
  await prisma.task.deleteMany({})
  await prisma.project.deleteMany({})

  // Create Work project and its tasks
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
  })

  // Create Home project and its tasks
  await prisma.project.create({
    data: {
      name: 'Home',
      tasks: {
        create: [
          { title: 'Buy groceries', done: false }
        ]
      }
    }
  })

  console.log('Database seeded successfully!')
}
