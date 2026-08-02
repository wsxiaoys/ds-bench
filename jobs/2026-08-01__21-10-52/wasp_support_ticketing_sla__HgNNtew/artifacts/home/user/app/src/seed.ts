import { createProviderId, createUser, sanitizeAndSerializeProviderData } from 'wasp/server/auth'

export const seedData = async (prisma: any) => {
  // Clear existing data to ensure clean state
  await prisma.ticket.deleteMany({})
  await prisma.user.deleteMany({})

  // 1. Create manager
  const managerProviderId = createProviderId('username', 'manager')
  const managerProviderData = await sanitizeAndSerializeProviderData({
    hashedPassword: 'password123'
  })
  await createUser(managerProviderId, managerProviderData, {
    username: 'manager',
    password: 'password123',
    role: 'MANAGER'
  })

  // 2. Create agent1
  const agent1ProviderId = createProviderId('username', 'agent1')
  const agent1ProviderData = await sanitizeAndSerializeProviderData({
    hashedPassword: 'password123'
  })
  await createUser(agent1ProviderId, agent1ProviderData, {
    username: 'agent1',
    password: 'password123',
    role: 'AGENT'
  })

  // 3. Create agent2
  const agent2ProviderId = createProviderId('username', 'agent2')
  const agent2ProviderData = await sanitizeAndSerializeProviderData({
    hashedPassword: 'password123'
  })
  await createUser(agent2ProviderId, agent2ProviderData, {
    username: 'agent2',
    password: 'password123',
    role: 'AGENT'
  })

  // 4. Create customer1
  const customer1ProviderId = createProviderId('username', 'customer1')
  const customer1ProviderData = await sanitizeAndSerializeProviderData({
    hashedPassword: 'password123'
  })
  await createUser(customer1ProviderId, customer1ProviderData, {
    username: 'customer1',
    password: 'password123',
    role: 'CUSTOMER'
  })

  console.log('Database seeded successfully!')
}
