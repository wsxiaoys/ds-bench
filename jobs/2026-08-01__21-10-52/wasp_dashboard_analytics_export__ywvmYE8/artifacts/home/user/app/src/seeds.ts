import { createProviderId, createUser, sanitizeAndSerializeProviderData } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
  // Check if any user already exists
  let user = await prisma.user.findFirst();
  
  if (!user) {
    const providerId = createProviderId("username", "testuser");
    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: "password123",
    });
    user = await createUser(providerId, providerData, {});
  }

  // Clear existing transactions to ensure exact match for seeding
  await prisma.transaction.deleteMany({
    where: {
      userId: user.id,
    },
  });

  const transactions = [
    {
      date: new Date("2026-07-01T00:00:00.000Z"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
    },
    {
      date: new Date("2026-07-15T00:00:00.000Z"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
    },
    {
      date: new Date("2026-07-20T00:00:00.000Z"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
    },
    {
      date: new Date("2026-07-25T00:00:00.000Z"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
    },
  ];

  for (const t of transactions) {
    await prisma.transaction.create({
      data: {
        ...t,
        userId: user.id,
      },
    });
  }

  console.log("Database seeded successfully with testuser and 4 transactions.");
};
