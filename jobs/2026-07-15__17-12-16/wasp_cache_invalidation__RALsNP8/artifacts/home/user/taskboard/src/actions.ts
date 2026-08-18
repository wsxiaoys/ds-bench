export const addTask = async (args: { projectId: any; title: string }, context: any) => {
  const projectId = parseInt(args.projectId);
  if (!args.title) {
    throw new Error('Title is required');
  }
  if (isNaN(projectId)) {
    throw new Error('Valid projectId is required');
  }
  return context.entities.Task.create({
    data: {
      title: args.title,
      done: false,
      project: {
        connect: { id: projectId }
      }
    }
  });
};

export const toggleTask = async (args: { id: any }, context: any) => {
  const taskId = parseInt(args.id);
  if (isNaN(taskId)) {
    throw new Error('Valid task id is required');
  }
  const task = await context.entities.Task.findUnique({
    where: { id: taskId }
  });
  if (!task) {
    throw new Error(`Task with id ${args.id} not found`);
  }
  return context.entities.Task.update({
    where: { id: taskId },
    data: { done: !task.done }
  });
};
