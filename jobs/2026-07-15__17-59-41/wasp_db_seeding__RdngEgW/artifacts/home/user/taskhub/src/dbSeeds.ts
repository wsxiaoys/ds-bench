import type { DbSeedFn } from "wasp/server"
import { sanitizeAndSerializeProviderData } from "wasp/server/auth"
import type { PrismaClient } from "wasp/server"

type UserSeed = {
  username: string
  password: string
}

const users: UserSeed[] = [
  { username: "alice", password: "Passw0rd!alice" },
  { username: "bob", password: "Passw0rd!bob" },
  { username: "carol", password: "Passw0rd!carol" },
]

const projectNames = ["Inbox", "Website Redesign"]

const taskSpecs = [
  { description: "Draft plan", isDone: true },
  { description: "Review with team", isDone: false },
  { description: "Ship it", isDone: false },
]

export const devSeed: DbSeedFn = async (prisma: PrismaClient): Promise<void> => {
  for (const { username, password } of users) {
    const user = await findOrCreateUser(prisma, { username, password })

    for (const name of projectNames) {
      const project = await prisma.project.upsert({
        where: { userId_name: { userId: user.id, name } },
        create: { name, userId: user.id },
        update: {},
      })

      for (const { description, isDone } of taskSpecs) {
        await prisma.task.upsert({
          where: { projectId_description: { projectId: project.id, description } },
          create: { description, isDone, projectId: project.id },
          update: { isDone },
        })
      }
    }
  }
}

async function findOrCreateUser(
  prisma: PrismaClient,
  data: UserSeed,
) {
  const existingUser = await prisma.user.findFirst({
    where: {
      auth: {
        identities: {
          some: {
            providerName: "username",
            providerUserId: data.username,
          },
        },
      },
    },
  })

  if (existingUser) {
    return existingUser
  }

  const newUser = await prisma.user.create({
    data: {
      auth: {
        create: {
          identities: {
            create: {
              providerName: "username",
              providerUserId: data.username,
              providerData: await sanitizeAndSerializeProviderData<"username">({
                hashedPassword: data.password,
              }),
            },
          },
        },
      },
    },
  })

  return newUser
}