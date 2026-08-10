import type { DbSeedFn } from "wasp/server";

export const seedData: DbSeedFn = async (prisma) => {
  // Create test user
  const user = await prisma.user.create({
    data: {
      id: 1,
    },
  });

  // Seed transactions
  const transactions = [
    {
      date: new Date("2026-07-01"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
      userId: user.id,
    },
    {
      date: new Date("2026-07-15"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
      userId: user.id,
    },
    {
      date: new Date("2026-07-20"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
      userId: user.id,
    },
    {
      date: new Date("2026-07-25"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
      userId: user.id,
    },
  ];

  for (const t of transactions) {
    await prisma.transaction.create({ data: t });
  }
};
