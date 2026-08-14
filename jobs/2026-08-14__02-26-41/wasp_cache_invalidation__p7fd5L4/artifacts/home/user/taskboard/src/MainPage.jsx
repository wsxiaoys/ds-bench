import { useState } from 'react';
import { getTasks, getProjectStats, addTask, toggleTask, useQuery } from 'wasp/client/operations';
import { useQueryClient } from '@tanstack/react-query';
import './Main.css';

export const MainPage = () => {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks);
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats);
  const queryClient = useQueryClient();

  const [taskTitles, setTaskTitles] = useState({}); // projectId -> title string

  const handleToggle = async (taskId) => {
    try {
      await toggleTask({ id: taskId });
      // Manually invalidate getProjectStats since it does not depend on Task entity
      await queryClient.invalidateQueries({ queryKey: [getProjectStats.queryCacheKey] });
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleAddTaskClick = async (projectId) => {
    const title = taskTitles[projectId]?.trim() || 'New Task';
    try {
      await addTask({ projectId, title });
      // Reset the local input state for this project
      setTaskTitles((prev) => ({ ...prev, [projectId]: '' }));
      // Manually invalidate getProjectStats since it does not depend on Task entity
      await queryClient.invalidateQueries({ queryKey: [getProjectStats.queryCacheKey] });
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  if (tasksLoading || statsLoading) {
    return <div className="loading">Loading taskboard...</div>;
  }

  if (tasksError || statsError) {
    return (
      <div className="error">
        Error loading data: {tasksError?.message || statsError?.message}
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Reactive Task Board</h1>
      </header>

      <main className="main-content">
        <section className="projects-section">
          <h2>Projects</h2>
          <div className="projects-grid">
            {stats?.map((project) => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <div className="project-stats">
                  <p>
                    Total Tasks:{' '}
                    <span data-testid={`stat-total-${project.id}`}>
                      {project.total}
                    </span>
                  </p>
                  <p>
                    Done Tasks:{' '}
                    <span data-testid={`stat-done-${project.id}`}>
                      {project.done}
                    </span>
                  </p>
                </div>

                <div className="add-task-form">
                  <input
                    type="text"
                    placeholder="New task title..."
                    value={taskTitles[project.id] || ''}
                    onChange={(e) =>
                      setTaskTitles((prev) => ({
                        ...prev,
                        [project.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    data-testid={`add-task-${project.id}`}
                    onClick={() => handleAddTaskClick(project.id)}
                  >
                    Add Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tasks-section">
          <h2>All Tasks</h2>
          <ul className="tasks-list">
            {tasks?.map((task) => {
              const project = stats?.find((p) => p.id === task.projectId);
              return (
                <li
                  key={task.id}
                  data-testid={`task-${task.id}`}
                  className={`task-item ${task.done ? 'completed' : ''}`}
                >
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    {project && (
                      <span className="task-project-tag">({project.name})</span>
                    )}
                  </div>
                  <button
                    data-testid={`toggle-${task.id}`}
                    onClick={() => handleToggle(task.id)}
                  >
                    {task.done ? 'Undo' : 'Complete'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
};
