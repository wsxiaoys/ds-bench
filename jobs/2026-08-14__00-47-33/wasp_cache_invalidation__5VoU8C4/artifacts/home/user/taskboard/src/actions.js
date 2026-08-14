import { HttpError } from 'wasp/server';

export const addTask = async (args, context) => {
  if (!args.title || typeof args.title !== 'string' || args.title.trim() === '') {
    throw new HttpError(400, 'Title is required');
  }
  if (!args.projectId) {
    throw new HttpError(400, 'Project ID is required');
  }
  return context.entities.Task.create({
    data: {
      title: args.title,
      done: false,
      project: {
        connect: { id: Number(args.projectId) }
      }
    }
  });
};

export const toggleTask = async (args, context) => {
  const id = args.id || args.taskId;
  if (!id) {
    throw new HttpError(400, 'Task ID is required');
  }
  const task = await context.entities.Task.findUnique({
    where: { id: Number(id) }
  });
  if (!task) {
    throw new HttpError(404, 'Task not found');
  }
  return context.entities.Task.update({
    where: { id: Number(id) },
    data: { done: !task.done }
  });
};
