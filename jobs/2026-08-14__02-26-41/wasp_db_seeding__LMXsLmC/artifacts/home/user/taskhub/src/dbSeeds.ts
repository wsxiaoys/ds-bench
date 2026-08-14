import { sanitizeAndSerializeProviderData } from "wasp/auth/utils"

export async function devSeed(prisma: any) {
  const usersToSeed = [
    { username: "alice", password: "Passw0rd!alice" },
    { username: "bob", password: "Passw0rd!bob" },
    { username: "carol", password: "Passw0rd!carol" },
  ]

  const projectsToSeed = ["Inbox", "Website Redesign"]

  const tasksToSeed = [
    { description: "Draft plan", isDone: true },
    { description: "Review with team", isDone: false },
    { description: "Ship it", isDone: false },
  ]

  for (const userData of usersToSeed) {
    const username = userData.username.toLowerCase()
    const password = userData.password

    // 1. Check if the user already exists by querying their AuthIdentity
    const existingIdentity = await prisma.authIdentity.findUnique({
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
    })

    let userId: number

    if (existingIdentity && existingIdentity.auth && existingIdentity.auth.user) {
      userId = existingIdentity.auth.user.id
      console.log(`User "${username}" already exists with ID ${userId}.`)
    } else {
      // 2. Hash and serialize the password using Wasp's server-side auth helper
      const providerData = await sanitizeAndSerializeProviderData<"username">({
        hashedPassword: password,
      })

      // 3. Create the User, connected to an Auth record and its username identity
      const user = await prisma.user.create({
        data: {
          auth: {
            create: {
              identities: {
                create: {
                  providerName: "username",
                  providerUserId: username,
                  providerData: providerData,
                },
              },
            },
          },
        },
      })
      userId = user.id
      console.log(`Created user "${username}" with ID ${userId}.`)
    }

    // 4. Create projects for the user
    for (const projectName of projectsToSeed) {
      let project = await prisma.project.findUnique({
        where: {
          userId_name: {
            userId: userId,
            name: projectName,
          },
        },
      })

      if (!project) {
        project = await prisma.project.create({
          data: {
            name: projectName,
            userId: userId,
          },
        })
        console.log(`Created project "${projectName}" for user "${username}".`)
      } else {
        console.log(`Project "${projectName}" already exists for user "${username}".`)
      }

      // 5. Create tasks for the project
      for (const taskData of tasksToSeed) {
        const existingTask = await prisma.task.findUnique({
          where: {
            projectId_description: {
              projectId: project.id,
              description: taskData.description,
            },
          },
        })

        if (!existingTask) {
          await prisma.task.create({
            data: {
              description: taskData.description,
              isDone: taskData.isDone,
              projectId: project.id,
            },
          })
          console.log(`Created task "${taskData.description}" (isDone: ${taskData.isDone}) for project "${projectName}" of user "${username}".`)
        } else {
          if (existingTask.isDone !== taskData.isDone) {
            await prisma.task.update({
              where: { id: existingTask.id },
              data: { isDone: taskData.isDone },
            })
            console.log(`Updated task "${taskData.description}" to isDone: ${taskData.isDone} for project "${projectName}" of user "${username}".`)
          } else {
            console.log(`Task "${taskData.description}" already exists with correct state for project "${projectName}" of user "${username}".`)
          }
        }
      }
    }
  }
}

export default devSeed
