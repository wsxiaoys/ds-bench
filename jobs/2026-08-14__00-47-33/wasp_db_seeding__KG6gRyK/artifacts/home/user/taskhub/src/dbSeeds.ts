import { sanitizeAndSerializeProviderData } from "wasp/server/auth"

async function getOrCreateUser(prisma: any, username: string, passwordPlain: string) {
  // Find if AuthIdentity already exists for this username
  const authIdentity = await prisma.authIdentity.findUnique({
    where: {
      providerName_providerUserId: {
        providerName: "username",
        providerUserId: username,
      },
    },
    include: {
      auth: {
        include: {
          user: true,
        },
      },
    },
  });

  if (authIdentity) {
    return authIdentity.auth.user;
  }

  // Create the user
  const providerData = await sanitizeAndSerializeProviderData<'username'>({
    hashedPassword: passwordPlain,
  });

  const newUser = await prisma.user.create({
    data: {
      auth: {
        create: {
          identities: {
            create: {
              providerName: "username",
              providerUserId: username,
              providerData,
            },
          },
        },
      },
    },
  });

  return newUser;
}

export const devSeed = async (prisma: any) => {
  const usersToSeed = [
    { username: "alice", password: "Passw0rd!alice" },
    { username: "bob", password: "Passw0rd!bob" },
    { username: "carol", password: "Passw0rd!carol" },
  ];

  const projectsToSeed = ["Inbox", "Website Redesign"];

  const tasksToSeed = [
    { description: "Draft plan", isDone: true },
    { description: "Review with team", isDone: false },
    { description: "Ship it", isDone: false },
  ];

  for (const userData of usersToSeed) {
    const user = await getOrCreateUser(prisma, userData.username, userData.password);

    for (const projectName of projectsToSeed) {
      // Find or create project
      const project = await prisma.project.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: projectName,
          },
        },
        update: {},
        create: {
          userId: user.id,
          name: projectName,
        },
      });

      for (const taskData of tasksToSeed) {
        // Find or create task
        await prisma.task.upsert({
          where: {
            projectId_description: {
              projectId: project.id,
              description: taskData.description,
            },
          },
          update: {
            isDone: taskData.isDone,
          },
          create: {
            projectId: project.id,
            description: taskData.description,
            isDone: taskData.isDone,
          },
        });
      }
    }
  }

  console.log("Database successfully seeded!");
};
