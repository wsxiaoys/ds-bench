import { HttpError } from 'wasp/server'

export const addTask = async ({ projectId, title }, context) => {
  if (!title || title.trim() === '') {
    throw new HttpError(400, 'Title is required')
  }
  return context.entities.Task.create({
    data: {
      title,
      done: false,
      project: { connect: { id: projectId } }
    }
  });
};

export const toggleTask = async ({ taskId }, context) => {
  const task = await context.entities.Task.findUnique({
    where: { id: taskId }
  });
  if (!task) {
    throw new HttpError(404, 'Task not found')
  }
  return context.entities.Task.update({
    where: { id: taskId },
    data: {
      done: !task.done
    }
  });
};
