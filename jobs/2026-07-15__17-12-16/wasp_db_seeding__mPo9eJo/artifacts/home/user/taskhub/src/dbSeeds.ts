import {
  createProviderId,
  createUser,
  sanitizeAndSerializeProviderData,
} from 'wasp/server/auth'

export async function devSeed(prisma: any) {
  const users = [
    { username: 'alice', password: 'Passw0rd!alice' },
    { username: 'bob', password: 'Passw0rd!bob' },
    { username: 'carol', password: 'Passw0rd!carol' },
  ]

  const projectNames = ['Inbox', 'Website Redesign']

  const tasks = [
    { description: 'Draft plan', isDone: true },
    { description: 'Review with team', isDone: false },
    { description: 'Ship it', isDone: false },
  ]

  for (const user of users) {
    const userId = await getOrCreateUser(prisma, user.username, user.password)

    for (const projectName of projectNames) {
      const project = await prisma.project.upsert({
        where: {
          userId_name: {
            userId: userId,
            name: projectName,
          }
        },
        update: {},
        create: {
          userId: userId,
          name: projectName,
        }
      })

      for (const task of tasks) {
        await prisma.task.upsert({
          where: {
            projectId_description: {
              projectId: project.id,
              description: task.description,
            }
          },
          update: {
            isDone: task.isDone,
          },
          create: {
            projectId: project.id,
            description: task.description,
            isDone: task.isDone,
          }
        })
      }
    }
  }
}

async function getOrCreateUser(prisma: any, username: string, password: string): Promise<number> {
  const providerId = createProviderId('username', username)
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      providerName_providerUserId: {
        providerName: providerId.providerName,
        providerUserId: providerId.providerUserId,
      }
    },
    include: {
      auth: true
    }
  })

  if (existingIdentity && existingIdentity.auth) {
    return existingIdentity.auth.userId
  }

  const providerData = await sanitizeAndSerializeProviderData<'username'>({
    hashedPassword: password,
  })
  const newUser = await createUser(providerId, providerData, {})
  return newUser.id
}
