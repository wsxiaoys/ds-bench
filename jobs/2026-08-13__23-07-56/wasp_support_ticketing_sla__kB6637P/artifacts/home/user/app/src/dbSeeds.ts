import { sanitizeAndSerializeProviderData } from "wasp/server/auth";
import type { PrismaClient } from "@prisma/client";

export const seedData = async (prisma: PrismaClient) => {
  const usersToSeed = [
    { username: "manager", password: "password123", role: "MANAGER" },
    { username: "agent1", password: "password123", role: "AGENT" },
    { username: "agent2", password: "password123", role: "AGENT" },
    { username: "customer1", password: "password123", role: "CUSTOMER" },
  ];

  for (const user of usersToSeed) {
    const existing = await prisma.user.findUnique({
      where: { username: user.username },
    });
    if (existing) continue;

    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: user.password,
    });

    await prisma.user.create({
      data: {
        username: user.username,
        password: user.password,
        role: user.role,
        auth: {
          create: {
            identities: {
              create: {
                providerName: "username",
                providerUserId: user.username,
                providerData: providerData,
              },
            },
          },
        },
      },
    });
  }
};
