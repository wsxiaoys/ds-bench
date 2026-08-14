import type { PrismaClient } from "wasp/server";
import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

export async function seedData(prisma: PrismaClient) {
  try {
    await prisma.transaction.deleteMany({});
    await prisma.user.deleteMany({});
  } catch (e) {
    console.log("Error during cleanup:", e);
  }

  const providerData = await sanitizeAndSerializeProviderData({
    hashedPassword: "password123",
  });

  const user = await prisma.user.create({
    data: {
      auth: {
        create: {
          identities: {
            create: {
              providerName: "username",
              providerUserId: "testuser",
              providerData: providerData,
            },
          },
        },
      },
    },
  });

  const transactions = [
    {
      date: new Date("2026-07-01T00:00:00.000Z"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
      userId: user.id,
    },
    {
      date: new Date("2026-07-15T00:00:00.000Z"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
      userId: user.id,
    },
    {
      date: new Date("2026-07-20T00:00:00.000Z"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
      userId: user.id,
    },
    {
      date: new Date("2026-07-25T00:00:00.000Z"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
      userId: user.id,
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: tx,
    });
  }

  console.log("Seeding complete!");
}
