export const getTasks = async (args: any, context: any) => {
  return context.entities.Task.findMany({
    orderBy: { id: 'asc' }
  });
};

export const getProjectStats = async (args: any, context: any) => {
  const projects = await context.entities.Project.findMany({
    include: {
      tasks: true
    },
    orderBy: { id: 'asc' }
  });
  return projects.map((p: any) => ({
    id: p.id,
    name: p.name,
    totalTasks: p.tasks.length,
    doneTasks: p.tasks.filter((t: any) => t.done).length
  }));
};
