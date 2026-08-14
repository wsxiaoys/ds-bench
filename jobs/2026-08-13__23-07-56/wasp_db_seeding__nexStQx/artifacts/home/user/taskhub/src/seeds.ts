import { PrismaClient } from "@prisma/client";
import { sanitizeAndSerializeProviderData } from "wasp/server/auth";

export async function devSeed(prisma: PrismaClient) {
  const users = [
    { username: "alice", password: "Passw0rd!alice" },
    { username: "bob", password: "Passw0rd!bob" },
    { username: "carol", password: "Passw0rd!carol" },
  ];

  for (const u of users) {
    const username = u.username.toLowerCase();
    
    // Check if the identity already exists
    const identity = await prisma.authIdentity.findUnique({
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

    let user;
    if (identity && identity.auth && identity.auth.user) {
      user = identity.auth.user;
    } else {
      // Create user using prisma
      const serializedProviderData = await sanitizeAndSerializeProviderData<"username">({
        hashedPassword: u.password,
      });

      user = await prisma.user.create({
        data: {
          auth: {
            create: {
              identities: {
                create: {
                  providerName: "username",
                  providerUserId: username,
                  providerData: serializedProviderData,
                },
              },
            },
          },
        },
      });
    }

    const projectNames = ["Inbox", "Website Redesign"];
    for (const projectName of projectNames) {
      // Find or create project
      let project = await prisma.project.findUnique({
        where: {
          userId_name: {
            userId: user.id,
            name: projectName,
          },
        },
      });

      if (!project) {
        project = await prisma.project.create({
          data: {
            name: projectName,
            userId: user.id,
          },
        });
      }

      const tasksData = [
        { description: "Draft plan", isDone: true },
        { description: "Review with team", isDone: false },
        { description: "Ship it", isDone: false },
      ];

      for (const taskData of tasksData) {
        // Find or create task
        const existingTask = await prisma.task.findUnique({
          where: {
            projectId_description: {
              projectId: project.id,
              description: taskData.description,
            },
          },
        });

        if (!existingTask) {
          await prisma.task.create({
            data: {
              description: taskData.description,
              isDone: taskData.isDone,
              projectId: project.id,
            },
          });
        } else {
          // Update isDone if it's different
          if (existingTask.isDone !== taskData.isDone) {
            await prisma.task.update({
              where: {
                id: existingTask.id,
              },
              data: {
                isDone: taskData.isDone,
              },
            });
          }
        }
      }
    }
  }
}
