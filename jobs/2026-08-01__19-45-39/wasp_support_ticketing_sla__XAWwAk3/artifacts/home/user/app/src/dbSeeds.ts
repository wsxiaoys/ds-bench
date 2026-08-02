import type { DbSeedFn, PrismaClient } from "wasp/server";
import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

async function createUserWithAuth(
  prisma: PrismaClient,
  data: { username: string; password: string; role: string },
) {
  return prisma.user.create({
    data: {
      username: data.username,
      password: data.password,
      role: data.role,
      auth: {
        create: {
          identities: {
            create: {
              providerName: "username",
              providerUserId: data.username,
              providerData: await sanitizeAndSerializeProviderData<"username">(
                {
                  hashedPassword: data.password,
                },
              ),
            },
          },
        },
      },
    },
  });
}

export const seedData: DbSeedFn = async (prisma) => {
  await createUserWithAuth(prisma, {
    username: "manager",
    password: "password123",
    role: "MANAGER",
  });

  await createUserWithAuth(prisma, {
    username: "agent1",
    password: "password123",
    role: "AGENT",
  });

  await createUserWithAuth(prisma, {
    username: "agent2",
    password: "password123",
    role: "AGENT",
  });

  await createUserWithAuth(prisma, {
    username: "customer1",
    password: "password123",
    role: "CUSTOMER",
  });
};
