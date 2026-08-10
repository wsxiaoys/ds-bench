import type { DbSeedFn } from "wasp/server";

export const seedData: DbSeedFn = async (prisma) => {
  // Create manager
  await prisma.user.upsert({
    where: { username: "manager" },
    update: {},
    create: {
      username: "manager",
      password: "password123",
      role: "MANAGER",
    },
  });

  // Create agents
  await prisma.user.upsert({
    where: { username: "agent1" },
    update: {},
    create: {
      username: "agent1",
      password: "password123",
      role: "AGENT",
    },
  });

  await prisma.user.upsert({
    where: { username: "agent2" },
    update: {},
    create: {
      username: "agent2",
      password: "password123",
      role: "AGENT",
    },
  });

  // Create customer
  await prisma.user.upsert({
    where: { username: "customer1" },
    update: {},
    create: {
      username: "customer1",
      password: "password123",
      role: "CUSTOMER",
    },
  });
};
