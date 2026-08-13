import React, { useState } from 'react'
import { useQuery, getTasks, getProjectStats, addTask, toggleTask } from 'wasp/client/operations'
import { useQueryClient } from '@tanstack/react-query'
import './Main.css'

export const MainPage = () => {
  const queryClient = useQueryClient()
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks)
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats)

  const [newTitles, setNewTitles] = useState({})

  const handleAddTask = async (projectId) => {
    const title = newTitles[projectId] || ''
    if (!title.trim()) return
    try {
      await addTask({ projectId, title })
      setNewTitles(prev => ({ ...prev, [projectId]: '' }))
      // Manually invalidate getProjectStats cache
      queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      alert(err.message || 'Error adding task')
    }
  }

  const handleToggleTask = async (taskId) => {
    try {
      await toggleTask({ taskId })
      // Manually invalidate getProjectStats cache
      queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      alert(err.message || 'Error toggling task')
    }
  }

  if (tasksLoading || statsLoading) return <div className="loading">Loading...</div>
  if (tasksError || statsError) return <div className="error">Error: {(tasksError || statsError).message}</div>

  return (
    <div className="taskboard-container">
      <header className="taskboard-header">
        <h1>Reactive Task Board</h1>
      </header>

      <div className="taskboard-content">
        <section className="projects-section">
          <h2>Projects & Stats</h2>
          <div className="projects-grid">
            {stats && stats.map(project => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <div className="project-stats">
                  <p>
                    Total Tasks:{' '}
                    <span data-testid={`stat-total-${project.id}`} className="stat-number">
                      {project.total}
                    </span>
                  </p>
                  <p>
                    Done Tasks:{' '}
                    <span data-testid={`stat-done-${project.id}`} className="stat-number">
                      {project.done}
                    </span>
                  </p>
                </div>
                <div className="add-task-form">
                  <input
                    type="text"
                    placeholder="New task title..."
                    value={newTitles[project.id] || ''}
                    onChange={(e) => setNewTitles(prev => ({ ...prev, [project.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTask(project.id)
                      }
                    }}
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
            {tasks && tasks.map(task => {
              const project = stats ? stats.find(p => p.id === task.projectId) : null;
              return (
                <li key={task.id} data-testid={`task-${task.id}`} className={`task-item ${task.done ? 'done' : ''}`}>
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    {project && <span className="task-project">({project.name})</span>}
                  </div>
                  <button
                    data-testid={`toggle-${task.id}`}
                    onClick={() => handleToggleTask(task.id)}
                    className="toggle-button"
                  >
                    {task.done ? 'Undo' : 'Complete'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
