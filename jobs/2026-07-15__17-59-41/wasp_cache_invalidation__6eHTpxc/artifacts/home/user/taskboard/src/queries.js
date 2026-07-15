// Returns every task with its id, title, done state and project id.
// Declared with the Task entity in main.wasp, so Wasp automatically
// invalidates this Query whenever an Action that shares the Task entity
// (addTask / toggleTask) runs.
export const getTasks = async (_args, context) => {
  return context.entities.Task.findMany({
    select: {
      id: true,
      title: true,
      done: true,
      projectId: true,
    },
  })
}

// Derived/computed aggregate: for every project, returns its id, name, the
// total number of tasks and the number of done tasks.
//
// This Query is intentionally declared with only the Project entity (see
// main.wasp). Because it depends on Task data only through a Prisma relation
// (not through a declared entity), Wasp's automatic invalidation will NOT
// refresh it when addTask / toggleTask run. The client must invalidate it
// manually after those Actions.
export const getProjectStats = async (_args, context) => {
  const projects = await context.entities.Project.findMany({
    include: {
      tasks: {
        select: { done: true },
      },
    },
  })
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    total: project.tasks.length,
    done: project.tasks.filter((task) => task.done).length,
  }))
}