import type { DbSeedFn } from "wasp/server";
import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

export const seedData: DbSeedFn = async (prisma) => {
  // Check if testuser already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      auth: {
        identities: {
          some: {
            providerName: "username",
            providerUserId: "testuser",
          },
        },
      },
    },
  });

  let user;
  if (!existingUser) {
    user = await prisma.user.create({
      data: {
        auth: {
          create: {
            identities: {
              create: {
                providerName: "username",
                providerUserId: "testuser",
                providerData: await sanitizeAndSerializeProviderData<"username">({
                  hashedPassword: "password123",
                }),
              },
            },
          },
        },
      },
    });
  } else {
    user = existingUser;
  }

  // Clear existing transactions for this user so seeding is idempotent/exact
  await prisma.transaction.deleteMany({
    where: { userId: user.id },
  });

  // Seed exactly the 4 transactions
  const transactionsToSeed = [
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

  for (const tx of transactionsToSeed) {
    await prisma.transaction.create({
      data: tx,
    });
  }
};
