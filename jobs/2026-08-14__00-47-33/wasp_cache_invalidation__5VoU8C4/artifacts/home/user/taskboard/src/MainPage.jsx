import React, { useState } from 'react'
import { useQuery, getTasks, getProjectStats, addTask, toggleTask } from 'wasp/client/operations'
import { useQueryClient } from '@tanstack/react-query'
import './Main.css'

export const MainPage = () => {
  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(getProjectStats)
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery(getTasks)

  const [newTaskTitles, setNewTaskTitles] = useState({})

  const handleAddTask = async (projectId) => {
    const title = newTaskTitles[projectId]
    if (!title || title.trim() === '') return

    try {
      await addTask({ projectId, title: title.trim() })
      setNewTaskTitles(prev => ({ ...prev, [projectId]: '' }))
      // Manually invalidate the getProjectStats query cache
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error adding task:', err)
      alert('Failed to add task: ' + err.message)
    }
  }

  const handleToggleTask = async (taskId) => {
    try {
      await toggleTask({ id: taskId })
      // Manually invalidate the getProjectStats query cache
      await queryClient.invalidateQueries({ queryKey: getProjectStats.queryCacheKey })
    } catch (err) {
      console.error('Error toggling task:', err)
      alert('Failed to toggle task: ' + err.message)
    }
  }

  if (statsLoading || tasksLoading) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading Task Board...</h2>
      </div>
    )
  }

  if (statsError || tasksError) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h2>Error loading data</h2>
        <p>{(statsError || tasksError)?.message}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '2px solid #eee', paddingBottom: '1rem' }}>
        <h1 style={{ margin: 0, color: '#333' }}>Reactive Task Board</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#666' }}>
          Manage your projects and tasks with automatic and manual query invalidation.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Projects and Stats Section */}
        <section style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
            Projects &amp; Stats
          </h2>
          {stats && stats.length > 0 ? (
            stats.map(project => (
              <div
                key={project.id}
                style={{
                  background: '#fff',
                  padding: '1rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #eee'
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#111' }}>{project.name}</h3>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', color: '#555', fontSize: '0.9rem' }}>
                  <div>
                    Total Tasks:{' '}
                    <strong style={{ fontSize: '1.1rem', color: '#222' }}>
                      <span data-testid={`stat-total-${project.id}`}>{project.total}</span>
                    </strong>
                  </div>
                  <div>
                    Completed:{' '}
                    <strong style={{ fontSize: '1.1rem', color: '#2e7d32' }}>
                      <span data-testid={`stat-done-${project.id}`}>{project.done}</span>
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newTaskTitles[project.id] || ''}
                    onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [project.id]: e.target.value }))}
                    placeholder="New task title"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '0.9rem'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTask(project.id)
                      }
                    }}
                  />
                  <button
                    data-testid={`add-task-${project.id}`}
                    onClick={() => handleAddTask(project.id)}
                    style={{
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    Add Task
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No projects found. Please seed the database.</p>
          )}
        </section>

        {/* Tasks Section */}
        <section style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
            All Tasks
          </h2>
          {tasks && tasks.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tasks.map(task => {
                const project = stats ? stats.find(p => p.id === task.projectId) : null;
                return (
                  <li
                    key={task.id}
                    data-testid={`task-${task.id}`}
                    style={{
                      background: '#fff',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      border: '1px solid #eee',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span
                        style={{
                          textDecoration: task.done ? 'line-through' : 'none',
                          color: task.done ? '#888' : '#000',
                          fontWeight: 'bold',
                          fontSize: '1.05rem'
                        }}
                      >
                        {task.title}
                      </span>
                      {project && (
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>
                          Project: {project.name}
                        </div>
                      )}
                    </div>

                    <button
                      data-testid={`toggle-${task.id}`}
                      onClick={() => handleToggleTask(task.id)}
                      style={{
                        background: task.done ? '#757575' : '#2e7d32',
                        color: '#fff',
                        border: 'none',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}
                    >
                      {task.done ? 'Undo' : 'Complete'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No tasks found. Add a task to start!</p>
          )}
        </section>
      </div>
    </div>
  )
}
