import type { PrismaClient } from "wasp/server";
import { createProviderId, sanitizeAndSerializeProviderData, createUser } from "wasp/server/auth";

export const devSeed = async (prisma: PrismaClient) => {
  const usersData = [
    { username: "alice", password: "Passw0rd!alice" },
    { username: "bob", password: "Passw0rd!bob" },
    { username: "carol", password: "Passw0rd!carol" },
  ];

  const projectsData = [
    {
      name: "Inbox",
      tasks: [
        { description: "Draft plan", isDone: true },
        { description: "Review with team", isDone: false },
        { description: "Ship it", isDone: false },
      ],
    },
    {
      name: "Website Redesign",
      tasks: [
        { description: "Draft plan", isDone: true },
        { description: "Review with team", isDone: false },
        { description: "Ship it", isDone: false },
      ],
    },
  ];

  for (const userData of usersData) {
    const providerId = createProviderId("username", userData.username);

    // Find if user already exists
    let user = await prisma.user.findFirst({
      where: {
        auth: {
          identities: {
            some: {
              providerName: providerId.providerName,
              providerUserId: providerId.providerUserId,
            },
          },
        },
      },
    });

    if (!user) {
      const serializedProviderData = await sanitizeAndSerializeProviderData<"username">({
        hashedPassword: userData.password,
      });
      user = await createUser(providerId, serializedProviderData);
    }

    for (const projectData of projectsData) {
      const project = await prisma.project.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: projectData.name,
          },
        },
        update: {},
        create: {
          name: projectData.name,
          userId: user.id,
        },
      });

      for (const taskData of projectData.tasks) {
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
            description: taskData.description,
            isDone: taskData.isDone,
            projectId: project.id,
          },
        });
      }
    }
  }
};

export const checkDb = async (prisma: PrismaClient) => {
  const users = await prisma.user.findMany({
    include: {
      auth: {
        include: {
          identities: true,
        },
      },
      projects: {
        include: {
          tasks: true,
        },
      },
    },
  });

  console.log(`--- COUNT SUMMARY ---`);
  console.log(`Users count: ${users.length}`);
  for (const user of users) {
    const identity = user.auth?.identities[0];
    const username = identity?.providerUserId || "unknown";
    console.log(`User: ${username} (id: ${user.id})`);
    console.log(`  Projects count: ${user.projects.length}`);
    for (const project of user.projects) {
      console.log(`  - Project: ${project.name} (id: ${project.id})`);
      console.log(`    Tasks count: ${project.tasks.length}`);
      for (const task of project.tasks) {
        console.log(`      - Task: "${task.description}" (isDone: ${task.isDone}, id: ${task.id})`);
      }
    }
  }
};
