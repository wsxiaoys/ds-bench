import { type PrismaClient } from '@prisma/client'
import { sanitizeAndSerializeProviderData } from 'wasp/server/auth'

export async function seedData(prisma: PrismaClient) {
  console.log('Seeding database...')

  await createSeededUser(prisma, 'manager', 'password123', 'MANAGER')
  await createSeededUser(prisma, 'agent1', 'password123', 'AGENT')
  await createSeededUser(prisma, 'agent2', 'password123', 'AGENT')
  await createSeededUser(prisma, 'customer1', 'password123', 'CUSTOMER')

  console.log('Seeding completed successfully!')
}

async function createSeededUser(prisma: PrismaClient, username: string, passwordPlain: string, role: string) {
  // First, check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  })
  if (existingUser) {
    console.log(`User ${username} already exists, skipping.`)
    return existingUser
  }

  // Hash the password for Wasp Auth
  const providerData = await sanitizeAndSerializeProviderData<'username'>({
    hashedPassword: passwordPlain
  })

  // Create the User record with username, password, and role
  const user = await prisma.user.create({
    data: {
      username,
      password: passwordPlain, // Store plain password on User model as requested by the prompt
      role,
    }
  })

  // Wasp's Auth record
  const auth = await prisma.auth.create({
    data: {
      userId: user.id,
    }
  })

  // Wasp's AuthIdentity record
  await prisma.authIdentity.create({
    data: {
      providerName: 'username',
      providerUserId: username,
      providerData: providerData || '{}',
      authId: auth.id,
    }
  })

  return user
}
