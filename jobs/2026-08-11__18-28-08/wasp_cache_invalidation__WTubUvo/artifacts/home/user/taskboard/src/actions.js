export const addTask = async (args, context) => {
  const { title, projectId } = args;
  if (!title) {
    throw new Error("Title is required.");
  }
  if (!projectId) {
    throw new Error("projectId is required.");
  }
  return context.entities.Task.create({
    data: {
      title,
      projectId: Number(projectId),
      done: false
    }
  });
};

export const toggleTask = async (args, context) => {
  const { id } = args;
  if (!id) {
    throw new Error("Task id is required.");
  }
  const task = await context.entities.Task.findUnique({
    where: { id: Number(id) }
  });
  if (!task) {
    throw new Error(`Task with id ${id} not found.`);
  }
  return context.entities.Task.update({
    where: { id: Number(id) },
    data: {
      done: !task.done
    }
  });
};
