import {
  createProviderId,
  sanitizeAndSerializeProviderData,
  createUser,
} from "wasp/server/auth"
import type { DbSeedFn } from "wasp/server"

type UserSeed = {
  username: string
  password: string
}

const userSeeds: UserSeed[] = [
  { username: "alice", password: "Passw0rd!alice" },
  { username: "bob", password: "Passw0rd!bob" },
  { username: "carol", password: "Passw0rd!carol" },
]

const projectSeeds = ["Inbox", "Website Redesign"] as const

type TaskSeed = { description: string; isDone: boolean }

const taskSeeds: TaskSeed[] = [
  { description: "Draft plan", isDone: true },
  { description: "Review with team", isDone: false },
  { description: "Ship it", isDone: false },
]

/**
 * Idempotent dev seed: creates three auth-enabled users (alice, bob, carol)
 * with two projects ("Inbox", "Website Redesign") and three tasks each.
 *
 * Re-running `wasp db seed devSeed` is safe — existing users, projects, and
 * tasks are left untouched and any missing ones are created.
 */
export const devSeed: DbSeedFn = async (prisma) => {
  for (const { username, password } of userSeeds) {
    // Normalize the username exactly the way Wasp's auth system does
    // (lowercasing for the "username" provider).
    const providerId = createProviderId("username", username)

    // Re-use the existing user if they've already been seeded.
    let user = await prisma.user.findFirst({
      where: {
        auth: {
          identities: {
            some: {
              providerName: providerId.providerName,
              providerUserId: providerId.providerUserId,
            },
          },
        },
      },
    })

    if (!user) {
      // `sanitizeAndSerializeProviderData` hashes the password for us, so
      // we pass the plain-text password in.
      const providerData = await sanitizeAndSerializeProviderData<"username">({
        hashedPassword: password,
      })

      user = await createUser(providerId, providerData)
    }

    for (const name of projectSeeds) {
      // Project is uniquely identified by (userId, name), so upsert keeps
      // re-runs a no-op while still creating the row on first run.
      const project = await prisma.project.upsert({
        where: { userId_name: { userId: user.id, name } },
        update: {},
        create: { name, userId: user.id },
      })

      for (const { description, isDone } of taskSeeds) {
        // Tasks are uniquely identified by (projectId, description); the
        // upsert also re-syncs `isDone` in case it was changed externally.
        await prisma.task.upsert({
          where: {
            projectId_description: { projectId: project.id, description },
          },
          update: { isDone },
          create: { description, isDone, projectId: project.id },
        })
      }
    }
  }
}