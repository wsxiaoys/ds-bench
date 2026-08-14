export const addTask = async ({ projectId, title }, context) => {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new Error('Title is required');
  }
  return context.entities.Task.create({
    data: {
      title,
      done: false,
      project: { connect: { id: projectId } },
    },
  });
};

export const toggleTask = async (args, context) => {
  const id = args.id || args.taskId;
  const task = await context.entities.Task.findUnique({
    where: { id },
  });
  if (!task) {
    throw new Error('Task not found');
  }
  return context.entities.Task.update({
    where: { id },
    data: {
      done: !task.done,
    },
  });
};
