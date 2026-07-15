import { useQuery, useAction } from 'wasp/client/operations'
import { getTasks, getProjectStats, addTask, toggleTask } from 'wasp/client/operations'
import { useQueryClient } from '@tanstack/react-query'
import './Main.css'

export const MainPage = () => {
  const tasksQuery = useQuery(getTasks)
  const statsQuery = useQuery(getProjectStats)

  const queryClient = useQueryClient()

  // getTasks shares the Task entity with addTask/toggleTask, so Wasp refreshes
  // it automatically. getProjectStats is only declared with the Project entity,
  // so we invalidate it manually here after each Task action runs.
  const invalidateStats = () => {
    queryClient.invalidateQueries(getProjectStats.queryCacheKey)
  }

  const addTaskAction = useAction(addTask)
  const toggleTaskAction = useAction(toggleTask)

  const handleAddTask = async (projectId) => {
    // The new task's title may be any non-empty string.
    const title = `New task ${Date.now()}`
    await addTaskAction({ projectId, title })
    invalidateStats()
  }

  const handleToggleTask = async (taskId) => {
    await toggleTaskAction({ taskId })
    invalidateStats()
  }

  return (
    <div className="container">
      <main>
        <h2 className="welcome-title">Task Board</h2>

        <section>
          <h3>Projects</h3>
          {statsQuery.isLoading && <p>Loading stats…</p>}
          {statsQuery.error && <p>Error loading stats.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {statsQuery.data?.map((stat) => (
              <li key={stat.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{stat.name}</strong>{' '}
                <span data-testid={`stat-total-${stat.id}`}>{stat.total}</span>{' '}
                <span>done:</span>{' '}
                <span data-testid={`stat-done-${stat.id}`}>{stat.done}</span>{' '}
                <button
                  type="button"
                  data-testid={`add-task-${stat.id}`}
                  onClick={() => handleAddTask(stat.id)}
                >
                  Add task
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Tasks</h3>
          {tasksQuery.isLoading && <p>Loading tasks…</p>}
          {tasksQuery.error && <p>Error loading tasks.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasksQuery.data?.map((task) => (
              <li key={task.id} style={{ marginBottom: '0.25rem' }}>
                <span data-testid={`task-${task.id}`}>
                  {task.done ? '✅' : '⬜'} {task.title} (project {task.projectId})
                </span>{' '}
                <button
                  type="button"
                  data-testid={`toggle-${task.id}`}
                  onClick={() => handleToggleTask(task.id)}
                >
                  Toggle
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}