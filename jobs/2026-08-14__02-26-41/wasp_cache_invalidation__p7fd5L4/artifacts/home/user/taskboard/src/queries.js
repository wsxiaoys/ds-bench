export const getTasks = async (args, context) => {
  return context.entities.Task.findMany({
    orderBy: { id: 'asc' },
  });
};

export const getProjectStats = async (args, context) => {
  const projects = await context.entities.Project.findMany({
    include: {
      tasks: true,
    },
    orderBy: { id: 'asc' },
  });
  return projects.map((p) => {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.done).length;
    return {
      id: p.id,
      name: p.name,
      total,
      done,
    };
  });
};
