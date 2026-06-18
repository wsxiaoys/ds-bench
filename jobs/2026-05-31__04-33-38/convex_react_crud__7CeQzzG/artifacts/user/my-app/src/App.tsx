import { useState } from 'react'
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import './App.css'

const RUN_ID = import.meta.env.VITE_ZEALT_RUN_ID;

function App() {
  const [newTaskText, setNewTaskText] = useState("");
  const tasks = useQuery(api.tasks.list, { runId: RUN_ID });
  const addTask = useMutation(api.tasks.add);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const deleteTask = useMutation(api.tasks.remove);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addTask({ text: newTaskText, runId: RUN_ID });
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
          placeholder="New task..."
        />
        <button type="submit">Add Task</button>
      </form>

      <ul>
        {tasks?.map((task) => (
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
              {task.status === "todo" ? "Mark Done" : "Mark Todo"}
            </button>
            <button onClick={() => deleteTask({ id: task._id })}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App
