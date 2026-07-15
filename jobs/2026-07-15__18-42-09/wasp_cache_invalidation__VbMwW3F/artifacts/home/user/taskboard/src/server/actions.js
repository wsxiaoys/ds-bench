/**
 * Creates a new task in the given project.
 *
 * Both this Action and `toggleTask` declare `Task` as an entity, so Wasp will
 * automatically invalidate any Query that also reads `Task` (notably
 * `getTasks`). The derived `getProjectStats` Query deliberately does NOT
 * declare `Task`, so the client has to keep it fresh itself.
 */
export const addTask = async ({ projectId, title }, context) => {
  return context.entities.Task.create({
    data: {
      title,
      done: false,
      project: {
        connect: { id: projectId },
      },
    },
  });
};

/**
 * Flips a task's done state.
 */
export const toggleTask = async ({ taskId }, context) => {
  const task = await context.entities.Task.findUnique({
    where: { id: taskId },
    select: { id: true, done: true },
  });

  if (!task) {
    throw new Error(`Task with id ${taskId} not found`);
  }

  return context.entities.Task.update({
    where: { id: taskId },
    data: { done: !task.done },
  });
};