import { useQueryClient } from '@tanstack/react-query'
import {
  useQuery,
  useAction,
  getTasks,
  getProjectStats,
  addTask,
  toggleTask,
} from 'wasp/client/operations'
import './Main.css'

export const MainPage = () => {
  const queryClient = useQueryClient()

  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery(getTasks)

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery(getProjectStats)

  const addTaskFn = useAction(addTask)
  const toggleTaskFn = useAction(toggleTask)

  // getProjectStats is declared with only the `Project` entity (see
  // main.wasp), so Wasp's automatic cache invalidation will NOT refresh it
  // when addTask/toggleTask run (they only declare `Task`). We manually
  // invalidate its React Query cache entry using its `queryCacheKey`.
  const invalidateProjectStats = () => {
    queryClient.invalidateQueries(getProjectStats.queryCacheKey)
  }

  const handleAddTask = async (projectId) => {
    await addTaskFn({ projectId, title: `New task ${Date.now()}` })
    invalidateProjectStats()
  }

  const handleToggleTask = async (taskId) => {
    await toggleTaskFn({ taskId })
    invalidateProjectStats()
  }

  if (tasksLoading || statsLoading) {
    return (
      <div className="container">
        <main>Loading...</main>
      </div>
    )
  }

  if (tasksError || statsError) {
    return (
      <div className="container">
        <main>Error: {(tasksError || statsError).message}</main>
      </div>
    )
  }

  return (
    <div className="container">
      <main>
        <h1>Task Board</h1>

        {stats.map((project) => (
          <section key={project.id} style={{ marginBottom: '2rem' }}>
            <h2>{project.name}</h2>
            <p>
              Done: <span data-testid={`stat-done-${project.id}`}>{project.doneTasks}</span>
              {' / '}
              Total: <span data-testid={`stat-total-${project.id}`}>{project.totalTasks}</span>
            </p>
            <button
              data-testid={`add-task-${project.id}`}
              onClick={() => handleAddTask(project.id)}
            >
              Add Task
            </button>
            <ul>
              {tasks
                .filter((task) => task.projectId === project.id)
                .map((task) => (
                  <li key={task.id} data-testid={`task-${task.id}`}>
                    <span>{task.title}</span>{' '}
                    <span>{task.done ? '(done)' : '(not done)'}</span>{' '}
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
        ))}
      </main>
    </div>
  )
}
