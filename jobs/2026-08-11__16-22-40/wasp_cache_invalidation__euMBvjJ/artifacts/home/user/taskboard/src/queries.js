export const getTasks = async (args, context) => {
  return context.entities.Task.findMany({
    orderBy: { id: 'asc' }
  });
};

export const getProjectStats = async (args, context) => {
  const projects = await context.entities.Project.findMany({
    include: {
      _count: {
        select: { tasks: true }
      },
      tasks: {
        where: { done: true },
        select: { id: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  return projects.map(p => ({
    id: p.id,
    name: p.name,
    total: p._count.tasks,
    done: p.tasks.length
  }));
};
