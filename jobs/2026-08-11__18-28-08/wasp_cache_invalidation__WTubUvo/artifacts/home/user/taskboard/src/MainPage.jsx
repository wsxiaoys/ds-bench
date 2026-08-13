import React, { useState } from 'react'
import {
  useQuery,
  getTasks,
  getProjectStats,
  addTask,
  toggleTask
} from 'wasp/client/operations'
import { useQueryClient } from '@tanstack/react-query'
import './Main.css'

export const MainPage = () => {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks)
  const { data: projectStats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats)
  const queryClient = useQueryClient()

  // State to hold custom task titles per project
  const [newTitles, setNewTitles] = useState({})

  const handleAddTask = async (projectId) => {
    const title = (newTitles[projectId] || '').trim() || `Task ${Date.now()}`
    try {
      await addTask({ title, projectId })
      // Clear input
      setNewTitles(prev => ({ ...prev, [projectId]: '' }))
      // Manually invalidate getProjectStats cache
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error adding task:', err)
      alert('Failed to add task: ' + err.message)
    }
  }

  const handleToggleTask = async (taskId) => {
    try {
      await toggleTask({ id: taskId })
      // Manually invalidate getProjectStats cache
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error toggling task:', err)
      alert('Failed to toggle task: ' + err.message)
    }
  }

  if (tasksLoading || statsLoading) return <div className="loading">Loading...</div>
  if (tasksError || statsError) return <div className="error">Error loading data.</div>

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Task Board</h1>
      </header>

      <div className="board-layout">
        {/* Projects Column */}
        <section className="projects-section">
          <h2>Projects</h2>
          <div className="projects-grid">
            {projectStats?.map(project => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <div className="project-stats">
                  <p>
                    Total Tasks:{' '}
                    <strong data-testid={`stat-total-${project.id}`}>
                      {project.totalTasks}
                    </strong>
                  </p>
                  <p>
                    Done Tasks:{' '}
                    <strong data-testid={`stat-done-${project.id}`}>
                      {project.doneTasks}
                    </strong>
                  </p>
                </div>
                <div className="add-task-form">
                  <input
                    type="text"
                    placeholder="New task title..."
                    value={newTitles[project.id] || ''}
                    onChange={(e) =>
                      setNewTitles(prev => ({
                        ...prev,
                        [project.id]: e.target.value
                      }))
                    }
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

        {/* Tasks Column */}
        <section className="tasks-section">
          <h2>All Tasks</h2>
          <div className="tasks-list">
            {tasks?.map(task => {
              const project = projectStats?.find(p => p.id === task.projectId)
              return (
                <div
                  key={task.id}
                  data-testid={`task-${task.id}`}
                  className={`task-item ${task.done ? 'task-done' : ''}`}
                >
                  <div className="task-info">
                    <span className="task-title">{task.title}</span>
                    <span className="task-project">
                      ({project ? project.name : 'Unknown Project'})
                    </span>
                  </div>
                  <button
                    data-testid={`toggle-${task.id}`}
                    onClick={() => handleToggleTask(task.id)}
                    className="toggle-btn"
                  >
                    {task.done ? 'Undo' : 'Complete'}
                  </button>
                </div>
              )
            })}
            {tasks?.length === 0 && <p className="no-tasks">No tasks found.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
