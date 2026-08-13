import { type PrismaClient } from '@prisma/client'
import { sanitizeAndSerializeProviderData } from 'wasp/server/auth'

export const devSeed = async (prisma: PrismaClient) => {
  const users = [
    { username: 'alice', password: 'Passw0rd!alice' },
    { username: 'bob', password: 'Passw0rd!bob' },
    { username: 'carol', password: 'Passw0rd!carol' },
  ]

  for (const user of users) {
    // 1. Find or create User with Auth and AuthIdentity
    let userId: number

    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        providerName_providerUserId: {
          providerName: 'username',
          providerUserId: user.username,
        },
      },
      include: {
        auth: true,
      },
    })

    if (existingIdentity && existingIdentity.auth && existingIdentity.auth.userId) {
      userId = existingIdentity.auth.userId
    } else {
      const hashedPassword = await sanitizeAndSerializeProviderData<'username'>({
        hashedPassword: user.password,
      })

      const newUser = await prisma.user.create({
        data: {
          auth: {
            create: {
              identities: {
                create: {
                  providerName: 'username',
                  providerUserId: user.username,
                  providerData: hashedPassword,
                },
              },
            },
          },
        },
      })
      userId = newUser.id
    }

    // 2. Create Projects
    const projectNames = ['Inbox', 'Website Redesign']
    for (const name of projectNames) {
      const project = await prisma.project.upsert({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
        update: {},
        create: {
          userId,
          name,
        },
      })

      // 3. Create Tasks
      const tasks = [
        { description: 'Draft plan', isDone: true },
        { description: 'Review with team', isDone: false },
        { description: 'Ship it', isDone: false },
      ]

      for (const task of tasks) {
        await prisma.task.upsert({
          where: {
            projectId_description: {
              projectId: project.id,
              description: task.description,
            },
          },
          update: {
            isDone: task.isDone,
          },
          create: {
            projectId: project.id,
            description: task.description,
            isDone: task.isDone,
          },
        })
      }
    }
  }

  console.log('Database seeded successfully!')
}
