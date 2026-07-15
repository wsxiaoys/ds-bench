import type { DbSeedFn } from "wasp/server"
import { createProviderId, sanitizeAndSerializeProviderData } from "wasp/server/auth"

/**
 * Seed data used by `wasp db seed devSeed`.
 *
 * Running this seed multiple times is safe (idempotent):
 *  - Users are looked up by their `username` auth identity before creating one.
 *  - Projects are upserted on the `(userId, name)` unique constraint.
 *  - Tasks are upserted on the `(projectId, description)` unique constraint.
 */

type SeedUser = {
  username: string
  password: string
}

const SEED_USERS: SeedUser[] = [
  { username: "alice", password: "Passw0rd!alice" },
  { username: "bob", password: "Passw0rd!bob" },
  { username: "carol", password: "Passw0rd!carol" },
]

const SEED_PROJECT_NAMES = ["Inbox", "Website Redesign"]

const SEED_TASKS: { description: string; isDone: boolean }[] = [
  { description: "Draft plan", isDone: true },
  { description: "Review with team", isDone: false },
  { description: "Ship it", isDone: false },
]

async function getOrCreateSeedUserId(
  prisma: Parameters<DbSeedFn>[0],
  { username, password }: SeedUser,
): Promise<number> {
  const providerId = createProviderId("username", username)

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      providerName_providerUserId: providerId,
    },
    include: { auth: true },
  })

  if (existingIdentity) {
    const { userId } = existingIdentity.auth
    if (userId === null) {
      throw new Error(
        `Existing auth identity for "${username}" is not linked to a user.`,
      )
    }
    return userId
  }

  const providerData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: password,
  })

  const user = await prisma.user.create({
    data: {
      auth: {
        create: {
          identities: {
            create: {
              providerName: providerId.providerName,
              providerUserId: providerId.providerUserId,
              providerData,
            },
          },
        },
      },
    },
  })

  return user.id
}

export const devSeed: DbSeedFn = async (prisma) => {
  for (const seedUser of SEED_USERS) {
    const userId = await getOrCreateSeedUserId(prisma, seedUser)

    for (const name of SEED_PROJECT_NAMES) {
      const project = await prisma.project.upsert({
        where: {
          userId_name: { userId, name },
        },
        update: {},
        create: { name, userId },
      })

      for (const { description, isDone } of SEED_TASKS) {
        await prisma.task.upsert({
          where: {
            projectId_description: {
              projectId: project.id,
              description,
            },
          },
          update: { isDone },
          create: { description, isDone, projectId: project.id },
        })
      }
    }
  }

  console.log(
    `✅ Seeded ${SEED_USERS.length} user(s), each with ${SEED_PROJECT_NAMES.length} project(s) and ${SEED_TASKS.length} task(s) per project.`,
  )
}
