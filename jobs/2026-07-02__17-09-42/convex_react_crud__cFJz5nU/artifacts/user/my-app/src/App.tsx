import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import type { Doc, Id } from '../convex/_generated/dataModel'
import './App.css'

// The current test run id. This isolates data between concurrent
// test runs so each run only sees its own tasks.
const RUN_ID = import.meta.env.VITE_RUN_ID as string

type Task = Doc<'tasks'>

function App() {
  const tasks = useQuery(api.tasks.list, { runId: RUN_ID }) as
    | Task[]
    | undefined

  const addTask = useMutation(api.tasks.add)
  const updateStatus = useMutation(api.tasks.updateStatus)
  const removeTask = useMutation(api.tasks.remove)

  const [draft, setDraft] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (text.length === 0) return
    await addTask({ runId: RUN_ID, text })
    setDraft('')
  }

  const handleToggle = async (task: Task) => {
    const nextStatus = task.status === 'todo' ? 'done' : 'todo'
    await updateStatus({ id: task._id, status: nextStatus })
  }

  const handleDelete = async (id: Id<'tasks'>) => {
    await removeTask({ id })
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Task Manager</h1>
        <p className="app__subtitle">
          Run ID: <code>{RUN_ID}</code>
        </p>
      </header>

      <form className="app__form" onSubmit={handleSubmit}>
        <input
          className="app__input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What needs to be done?"
          aria-label="New task"
        />
        <button className="app__submit" type="submit" disabled={draft.trim().length === 0}>
          Add task
        </button>
      </form>

      <section className="app__list" aria-live="polite">
        {tasks === undefined ? (
          <p className="app__status">Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className="app__status">No tasks yet. Add one above to get started.</p>
        ) : (
          <ul className="tasks">
            {tasks.map((task) => (
              <li
                key={task._id}
                className={`tasks__item tasks__item--${task.status}`}
              >
                <span className="tasks__text">{task.text}</span>
                <span className="tasks__status">{task.status}</span>
                <div className="tasks__actions">
                  <button
                    type="button"
                    className="tasks__toggle"
                    onClick={() => handleToggle(task)}
                    aria-label={`Mark task "${task.text}" as ${
                      task.status === 'todo' ? 'done' : 'todo'
                    }`}
                  >
                    {task.status === 'todo' ? 'Mark done' : 'Mark todo'}
                  </button>
                  <button
                    type="button"
                    className="tasks__delete"
                    onClick={() => handleDelete(task._id)}
                    aria-label={`Delete task "${task.text}"`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default App
