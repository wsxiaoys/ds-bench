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
    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: "password123",
    });
    user = await prisma.user.create({
      data: {
        auth: {
          create: {
            identities: {
              create: {
                providerName: "username",
                providerUserId: "testuser",
                providerData,
              },
            },
          },
        },
      },
    });
    console.log("Created seed user: testuser");
  } else {
    user = existingUser;
    console.log("Seed user already exists");
  }

  // Seed exactly the following 4 transactions for this user:
  // 1. Date: `2026-07-01`, Amount: `5000.0`, Type: `INCOME`, Category: `Sales`, Description: `Project payment`
  // 2. Date: `2026-07-15`, Amount: `1200.0`, Type: `EXPENSE`, Category: `Marketing`, Description: `Ad campaign`
  // 3. Date: `2026-07-20`, Amount: `800.0`, Type: `EXPENSE`, Category: `Software`, Description: `SaaS subscriptions`
  // 4. Date: `2026-07-25`, Amount: `2500.0`, Type: `INCOME`, Category: `Investment`, Description: `Dividend payout`

  const transactionsData = [
    {
      date: new Date("2026-07-01T00:00:00Z"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
      userId: user.id,
    },
    {
      date: new Date("2026-07-15T00:00:00Z"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
      userId: user.id,
    },
    {
      date: new Date("2026-07-20T00:00:00Z"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
      userId: user.id,
    },
    {
      date: new Date("2026-07-25T00:00:00Z"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
      userId: user.id,
    },
  ];

  for (const tx of transactionsData) {
    const existingTx = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description,
      },
    });

    if (!existingTx) {
      await prisma.transaction.create({
        data: tx,
      });
      console.log(`Created transaction: ${tx.description}`);
    }
  }
};
