import type { PrismaClient } from "@prisma/client";
import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const seedData = async (prisma: PrismaClient) => {
  // Clear existing data
  await prisma.ticket.deleteMany({});
  await prisma.authIdentity.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.auth.deleteMany({});
  await prisma.user.deleteMany({});

  // Seed manager
  const managerProviderId = createProviderId("username", "manager");
  const managerProviderData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: "password123",
  });
  await createUser(managerProviderId, managerProviderData, {
    username: "manager",
    password: "password123",
    role: "MANAGER",
  });

  // Seed agents
  const agent1ProviderId = createProviderId("username", "agent1");
  const agent1ProviderData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: "password123",
  });
  await createUser(agent1ProviderId, agent1ProviderData, {
    username: "agent1",
    password: "password123",
    role: "AGENT",
  });

  const agent2ProviderId = createProviderId("username", "agent2");
  const agent2ProviderData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: "password123",
  });
  await createUser(agent2ProviderId, agent2ProviderData, {
    username: "agent2",
    password: "password123",
    role: "AGENT",
  });

  // Seed customer
  const customer1ProviderId = createProviderId("username", "customer1");
  const customer1ProviderData = await sanitizeAndSerializeProviderData<"username">({
    hashedPassword: "password123",
  });
  await createUser(customer1ProviderId, customer1ProviderData, {
    username: "customer1",
    password: "password123",
    role: "CUSTOMER",
  });

  console.log("Database seeded successfully!");
};
