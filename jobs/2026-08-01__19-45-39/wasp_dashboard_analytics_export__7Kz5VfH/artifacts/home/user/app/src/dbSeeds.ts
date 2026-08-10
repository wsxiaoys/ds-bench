import type { DbSeedFn } from "wasp/server";
import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

const SEED_TRANSACTIONS = [
  {
    date: "2026-07-01",
    amount: 5000.0,
    type: "INCOME",
    category: "Sales",
    description: "Project payment",
  },
  {
    date: "2026-07-15",
    amount: 1200.0,
    type: "EXPENSE",
    category: "Marketing",
    description: "Ad campaign",
  },
  {
    date: "2026-07-20",
    amount: 800.0,
    type: "EXPENSE",
    category: "Software",
    description: "SaaS subscriptions",
  },
  {
    date: "2026-07-25",
    amount: 2500.0,
    type: "INCOME",
    category: "Investment",
    description: "Dividend payout",
  },
] as const;

export const seedData: DbSeedFn = async (prisma) => {
  const user = await prisma.user.create({
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

  for (const transaction of SEED_TRANSACTIONS) {
    await prisma.transaction.create({
      data: {
        date: new Date(transaction.date),
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        description: transaction.description,
        userId: user.id,
      },
    });
  }
};
