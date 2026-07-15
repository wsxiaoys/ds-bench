import React, { useState } from 'react';
import { useQuery, getTasks, getProjectStats, addTask, toggleTask } from 'wasp/client/operations';
import { useQueryClient } from '@tanstack/react-query';
import './Main.css';

export const MainPage = () => {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks);
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats);
  const queryClient = useQueryClient();

  // State for new task titles, keyed by project ID
  const [newTitles, setNewTitles] = useState({});

  const handleAddTask = async (projectId) => {
    const title = newTitles[projectId]?.trim();
    if (!title) {
      alert('Please enter a task title');
      return;
    }
    try {
      await addTask({ projectId, title });
      setNewTitles(prev => ({ ...prev, [projectId]: '' }));
      // Manually invalidate project stats cache
      await queryClient.invalidateQueries({ queryKey: [getProjectStats.queryCacheKey] });
    } catch (err) {
      console.error('Error adding task:', err);
      alert('Failed to add task: ' + (err.message || err));
    }
  };

  const handleToggleTask = async (taskId) => {
    try {
      await toggleTask({ id: taskId });
      // Manually invalidate project stats cache
      await queryClient.invalidateQueries({ queryKey: [getProjectStats.queryCacheKey] });
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Failed to toggle task: ' + (err.message || err));
    }
  };

  if (tasksLoading || statsLoading) return <div className="loading">Loading...</div>;
  if (tasksError || statsError) return <div className="error">Error loading data</div>;

  return (
    <div className="container">
      <header className="header">
        <h1>Task Board</h1>
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
                    Total Tasks: <span data-testid={`stat-total-${project.id}`}>{project.totalTasks}</span>
                  </p>
                  <p>
                    Done Tasks: <span data-testid={`stat-done-${project.id}`}>{project.doneTasks}</span>
                  </p>
                </div>
                <div className="add-task-form">
                  <input
                    type="text"
                    placeholder="New task title..."
                    value={newTitles[project.id] || ''}
                    onChange={(e) => setNewTitles(prev => ({ ...prev, [project.id]: e.target.value }))}
                  />
                  <button
                    data-testid={`add-task-${project.id}`}
                    onClick={() => handleAddTask(project.id)}
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
            {tasks?.map((task) => (
              <li key={task.id} data-testid={`task-${task.id}`} className="task-item">
                <span className={task.done ? 'task-title done' : 'task-title'}>
                  {task.title} {task.done ? '✓' : ''}
                </span>
                <button
                  data-testid={`toggle-${task.id}`}
                  onClick={() => handleToggleTask(task.id)}
                >
                  {task.done ? 'Undo' : 'Complete'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};
