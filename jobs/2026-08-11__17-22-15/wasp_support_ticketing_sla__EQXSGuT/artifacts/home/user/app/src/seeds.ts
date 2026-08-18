import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Database already has users, skipping seed.");
    return;
  }

  const usersToSeed = [
    { username: "manager", password: "password123", role: "MANAGER" },
    { username: "agent1", password: "password123", role: "AGENT" },
    { username: "agent2", password: "password123", role: "AGENT" },
    { username: "customer1", password: "password123", role: "CUSTOMER" },
  ];

  for (const u of usersToSeed) {
    const providerId = createProviderId("username", u.username);
    const providerData = await sanitizeAndSerializeProviderData<"username">({
      hashedPassword: u.password,
    });
    await createUser(providerId, providerData, {
      username: u.username,
      password: u.password,
      role: u.role,
    });
  }
  console.log("Database seeding completed successfully.");
};
