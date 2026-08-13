import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
  let user = await prisma.user.findFirst();
  if (!user) {
    const providerId = createProviderId("username", "testuser");
    const providerData = await sanitizeAndSerializeProviderData({
      hashedPassword: "password123",
    });
    user = await createUser(providerId, providerData, {});
  }

  // Ensure we start clean for this user to have exactly the 4 required transactions
  await prisma.transaction.deleteMany({
    where: { userId: user.id }
  });

  await prisma.transaction.create({
    data: {
      date: new Date("2026-07-01T00:00:00.000Z"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
      userId: user.id
    }
  });

  await prisma.transaction.create({
    data: {
      date: new Date("2026-07-15T00:00:00.000Z"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
      userId: user.id
    }
  });

  await prisma.transaction.create({
    data: {
      date: new Date("2026-07-20T00:00:00.000Z"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
      userId: user.id
    }
  });

  await prisma.transaction.create({
    data: {
      date: new Date("2026-07-25T00:00:00.000Z"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
      userId: user.id
    }
  });

  console.log("Database seeded successfully with testuser and 4 transactions.");
};
