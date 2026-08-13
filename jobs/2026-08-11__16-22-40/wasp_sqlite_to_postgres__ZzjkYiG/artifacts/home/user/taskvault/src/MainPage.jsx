import React, { useState } from 'react'
import { useQuery, getTasks, createTask } from 'wasp/client/operations'

export const MainPage = () => {
  const { data: tasks, isLoading, error } = useQuery(getTasks)
  const [description, setDescription] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) return
    await createTask({ description })
    setDescription('')
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>TaskVault</h1>
      <form onSubmit={handleSubmit}>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="New task"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {tasks && tasks.map((task) => <li key={task.id}>{task.description}</li>)}
      </ul>
    </div>
  )
}
