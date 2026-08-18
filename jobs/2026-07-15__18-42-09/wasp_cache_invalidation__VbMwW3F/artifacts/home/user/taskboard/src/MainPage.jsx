import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTasks,
  getProjectStats,
  addTask,
  toggleTask,
} from 'wasp/client/operations'
import './Main.css'

/**
 * The page mounted at `/`.
 *
 * It reads two Queries and invokes two Actions:
 *  - `getTasks`    : Wasp keeps this fresh automatically because the Actions
 *                    share its `Task` entity.
 *  - `getProjectStats` : deliberately only declares `Project`, so Wasp does
 *                    NOT auto-invalidate it. We invalidate it ourselves using
 *                    the React Query `QueryClient` (react-query is bundled
 *                    with Wasp and importable from `@tanstack/react-query`).
 *                    A Wasp client Query exposes its cache key via
 *                    `query.queryCacheKey`, which we pass straight into
 *                    `queryClient.invalidateQueries(...)`.
 */
export const MainPage = () => {
  const { data: tasks, isLoading: tasksLoading } = useQuery(getTasks)
  const { data: projectStats, isLoading: statsLoading } = useQuery(getProjectStats)
  const queryClient = useQueryClient()

  const handleAddTask = async (projectId) => {
    const title = `New task ${Date.now()}`
    await addTask({ projectId, title })
    // `getProjectStats` does NOT auto-invalidate, so we do it ourselves.
    queryClient.invalidateQueries(getProjectStats.queryCacheKey)
  }

  const handleToggleTask = async (taskId) => {
    await toggleTask({ taskId })
    queryClient.invalidateQueries(getProjectStats.queryCacheKey)
  }

  if (tasksLoading || statsLoading) {
    return <div className="container">Loading...</div>
  }

  return (
    <div className="container">
      <main>
        <h1 className="welcome-title">Task Board</h1>

        <section>
          <h2>Projects</h2>
          {projectStats && projectStats.map((project) => (
            <div key={project.id} className="project">
              <h3>{project.name}</h3>
              <div>
                Total:{' '}
                <span data-testid={`stat-total-${project.id}`}>{project.total}</span>
              </div>
              <div>
                Done:{' '}
                <span data-testid={`stat-done-${project.id}`}>{project.done}</span>
              </div>
              <button
                data-testid={`add-task-${project.id}`}
                onClick={() => handleAddTask(project.id)}
              >
                Add task
              </button>
            </div>
          ))}
        </section>

        <section>
          <h2>Tasks</h2>
          <ul>
            {tasks && tasks.map((task) => (
              <li key={task.id} data-testid={`task-${task.id}`}>
                <span style={{ marginRight: '0.5rem' }}>
                  {task.title} {task.done ? '(done)' : ''}
                </span>
                <button
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