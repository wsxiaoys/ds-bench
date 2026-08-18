// Query: returns every task, with its id, title, done state and project id.
export const getTasks = async (_args, context) => {
  return context.entities.Task.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      title: true,
      done: true,
      projectId: true,
    },
  })
}

// Computed/derived Query: for every project, returns its id, name, the
// total number of tasks in that project, and the number of done tasks.
//
// NOTE: This query is intentionally declared (in main.wasp) with only the
// `Project` entity, even though the counts below are derived from the
// related `Task` rows. Wasp's automatic cache invalidation only kicks in
// when an Action that shares a declared entity runs, so Actions that only
// touch `Task` (addTask, toggleTask) will NOT automatically refresh this
// query on the client - the client has to invalidate it manually.
export const getProjectStats = async (_args, context) => {
  const projects = await context.entities.Project.findMany({
    orderBy: { id: 'asc' },
    include: {
      tasks: {
        select: { done: true },
      },
    },
  })

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    totalTasks: project.tasks.length,
    doneTasks: project.tasks.filter((task) => task.done).length,
  }))
}
