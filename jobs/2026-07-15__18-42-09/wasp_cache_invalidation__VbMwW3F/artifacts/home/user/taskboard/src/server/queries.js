/**
 * Returns every task with its id, title, done state and project id.
 *
 * Wasp automatically invalidates any query that declares the same entities as
 * an Action. We list `Task` so Wasp will keep `getTasks` in sync whenever
 * `addTask` or `toggleTask` runs.
 */
export const getTasks = async (_args, context) => {
  return context.entities.Task.findMany({
    select: {
      id: true,
      title: true,
      done: true,
      projectId: true,
    },
    orderBy: { id: 'asc' },
  });
};

/**
 * Returns, for every project, the project's id, its name, the total number of
 * tasks in that project, and the number of done tasks.
 *
 * NOTE: We intentionally only declare `Project` as the entity in `main.wasp`.
 * That means adding or toggling a task will NOT automatically invalidate this
 * query -- the client must keep it fresh manually using react-query.
 */
export const getProjectStats = async (_args, context) => {
  const projects = await context.entities.Project.findMany({
    select: {
      id: true,
      name: true,
      tasks: {
        select: {
          done: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    total: project.tasks.length,
    done: project.tasks.filter((t) => t.done).length,
  }));
};