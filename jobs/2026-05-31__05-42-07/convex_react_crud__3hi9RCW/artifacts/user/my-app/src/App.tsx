import { useState } from 'react'
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import './App.css'

function App() {
  const runId = import.meta.env.VITE_ZEALT_RUN_ID || "default-run-id";
  const tasks = useQuery(api.tasks.get, { runId });
  const addTask = useMutation(api.tasks.add);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const removeTask = useMutation(api.tasks.remove);

  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim() === "") return;
    await addTask({ text: newTaskText, runId });
    setNewTaskText("");
  };

  return (
    <div className="App">
      <h1>Task Manager</h1>
      <form onSubmit={handleAddTask}>
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="New Task"
        />
        <button type="submit">Add Task</button>
      </form>
      
      {tasks === undefined ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task._id}>
              <span style={{ textDecoration: task.status === "done" ? "line-through" : "none" }}>
                {task.text}
              </span>
              <button
                onClick={() =>
                  updateStatus({
                    id: task._id,
                    status: task.status === "todo" ? "done" : "todo",
                  })
                }
              >
                Toggle Status
              </button>
              <button onClick={() => removeTask({ id: task._id })}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
