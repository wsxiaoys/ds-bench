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

  return projects.map(project => {
    const totalTasks = project.tasks.length;
    const doneTasks = project.tasks.filter(t => t.done).length;
    return {
      id: project.id,
      name: project.name,
      totalTasks,
      doneTasks
    };
  });
};
