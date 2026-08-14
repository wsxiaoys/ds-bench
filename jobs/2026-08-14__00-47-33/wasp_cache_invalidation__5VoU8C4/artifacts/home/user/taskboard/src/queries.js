export const getTasks = async (args, context) => {
  return context.entities.Task.findMany({
    orderBy: { id: 'asc' }
  });
};

export const getProjectStats = async (args, context) => {
  const projects = await context.entities.Project.findMany({
    include: {
      tasks: true
    },
    orderBy: { id: 'asc' }
  });
  return projects.map(p => ({
    id: p.id,
    name: p.name,
    total: p.tasks.length,
    done: p.tasks.filter(t => t.done).length
  }));
};
