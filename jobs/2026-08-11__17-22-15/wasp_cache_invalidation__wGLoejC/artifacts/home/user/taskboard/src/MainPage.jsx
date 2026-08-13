import React, { useState } from 'react'
import { useQuery, getTasks, getProjectStats, addTask, toggleTask } from 'wasp/client/operations'
import { useQueryClient } from '@tanstack/react-query'
import './Main.css'

export const MainPage = () => {
  const queryClient = useQueryClient()
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks)
  const { data: projectStats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats)

  const [taskTitles, setTaskTitles] = useState({})

  const handleAddTask = async (projectId) => {
    const title = (taskTitles[projectId] || '').trim() || 'New Task'
    try {
      await addTask({ projectId, title })
      setTaskTitles(prev => ({ ...prev, [projectId]: '' }))
      // Manually invalidate the getProjectStats query cache since it's decoupled
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error adding task:', err)
    }
  }

  const handleToggleTask = async (taskId) => {
    try {
      await toggleTask({ id: taskId })
      // Manually invalidate the getProjectStats query cache since it's decoupled
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error toggling task:', err)
    }
  }

  if (tasksLoading || statsLoading) return <div className="loading">Loading...</div>
  if (tasksError || statsError) return <div className="error">Error loading data</div>

  return (
    <div className="container">
      <header className="header">
        <h1>Task Board</h1>
      </header>

      <main className="main-content">
        <section className="projects-section">
          <h2>Projects</h2>
          <div className="projects-grid">
            {projectStats && projectStats.map((project) => (
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
                    value={taskTitles[project.id] || ''}
                    onChange={(e) =>
                      setTaskTitles(prev => ({ ...prev, [project.id]: e.target.value }))
                    }
                    placeholder="New task title..."
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
          <div className="tasks-list">
            {tasks && tasks.map((task) => {
              const project = projectStats?.find(p => p.id === task.projectId)
              return (
                <div
                  key={task.id}
                  data-testid={`task-${task.id}`}
                  className={`task-item ${task.done ? 'task-done' : ''}`}
                >
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    {project && (
                      <span className="task-project-tag">{project.name}</span>
                    )}
                  </div>
                  <button
                    data-testid={`toggle-${task.id}`}
                    onClick={() => handleToggleTask(task.id)}
                    className={`toggle-btn ${task.done ? 'btn-done' : 'btn-todo'}`}
                  >
                    {task.done ? 'Mark Todo' : 'Mark Done'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
