import { sanitizeAndSerializeProviderData } from 'wasp/server/auth'
import type { PrismaClient } from '@prisma/client'

export async function devSeed(prisma: PrismaClient) {
  const usersToSeed = [
    { username: 'alice', password: 'Passw0rd!alice' },
    { username: 'bob', password: 'Passw0rd!bob' },
    { username: 'carol', password: 'Passw0rd!carol' },
  ]

  const projectsToSeed = ['Inbox', 'Website Redesign']

  const tasksToSeed = [
    { description: 'Draft plan', isDone: true },
    { description: 'Review with team', isDone: false },
    { description: 'Ship it', isDone: false },
  ]

  for (const userData of usersToSeed) {
    let user = await prisma.user.findFirst({
      where: {
        auth: {
          identities: {
            some: {
              providerName: 'username',
              providerUserId: userData.username,
            },
          },
        },
      },
    })

    if (!user) {
      const providerData = await sanitizeAndSerializeProviderData<'username'>({
        hashedPassword: userData.password,
      })
      user = await prisma.user.create({
        data: {
          auth: {
            create: {
              identities: {
                create: {
                  providerName: 'username',
                  providerUserId: userData.username,
                  providerData,
                },
              },
            },
          },
        },
      })
    }

    for (const projectName of projectsToSeed) {
      const project = await prisma.project.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: projectName,
          },
        },
        update: {},
        create: {
          name: projectName,
          userId: user.id,
        },
      })

      for (const taskData of tasksToSeed) {
        await prisma.task.upsert({
          where: {
            projectId_description: {
              projectId: project.id,
              description: taskData.description,
            },
          },
          update: {
            isDone: taskData.isDone,
          },
          create: {
            description: taskData.description,
            isDone: taskData.isDone,
            projectId: project.id,
          },
        })
      }
    }
  }
}
