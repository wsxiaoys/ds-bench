import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const seedData = async (prisma: any) => {
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

    if (!existing) {
      const providerId = createProviderId("username", user.username);
      const providerData = await sanitizeAndSerializeProviderData({
        hashedPassword: user.password,
      });
      const hashedPassword = JSON.parse(providerData).hashedPassword;
      await createUser(providerId, providerData, {
        username: user.username,
        password: hashedPassword || user.password,
        role: user.role,
      });
      console.log(`Seeded user: ${user.username} with role ${user.role}`);
    } else {
      console.log(`User already exists: ${user.username}`);
    }
  }
};
