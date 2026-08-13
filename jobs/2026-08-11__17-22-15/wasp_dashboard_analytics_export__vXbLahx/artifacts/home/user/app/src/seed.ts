import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
  // Check if testuser already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      auth: {
        identities: {
          some: {
            providerName: "username",
            providerUserId: "testuser"
          }
        }
      }
    }
  });

  let userId: number;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const newUser = await prisma.user.create({
      data: {
        auth: {
          create: {
            identities: {
              create: {
                providerName: "username",
                providerUserId: "testuser",
                providerData: await sanitizeAndSerializeProviderData({
                  hashedPassword: "password123"
                }),
              },
            },
          },
        },
      },
    });
    userId = newUser.id;
  }

  // Seed the 4 transactions
  // Clean existing transactions first to avoid duplicates or to match exactly the 4 transactions
  await prisma.transaction.deleteMany({
    where: { userId }
  });

  const transactions = [
    {
      date: new Date("2026-07-01T00:00:00Z"),
      amount: 5000.0,
      type: "INCOME",
      category: "Sales",
      description: "Project payment",
      userId
    },
    {
      date: new Date("2026-07-15T00:00:00Z"),
      amount: 1200.0,
      type: "EXPENSE",
      category: "Marketing",
      description: "Ad campaign",
      userId
    },
    {
      date: new Date("2026-07-20T00:00:00Z"),
      amount: 800.0,
      type: "EXPENSE",
      category: "Software",
      description: "SaaS subscriptions",
      userId
    },
    {
      date: new Date("2026-07-25T00:00:00Z"),
      amount: 2500.0,
      type: "INCOME",
      category: "Investment",
      description: "Dividend payout",
      userId
    }
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({ data: tx });
  }

  console.log("Seeding completed successfully!");
};
