"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const runId = process.env.NEXT_PUBLIC_ZEALT_RUN_ID || "default-run-id";
  const tasks = useQuery(api.tasks.get, { runId });
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);

  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addTask({ text: newTaskText.trim(), runId });
    setNewTaskText("");
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Task Manager</h1>
      
      <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="New task..."
          className="border rounded px-3 py-2 flex-grow text-black"
          data-testid="task-input"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
          data-testid="add-button"
        >
          Add Task
        </button>
      </form>

      {tasks === undefined ? (
        <p>Loading...</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task._id}
              className="flex items-center justify-between p-3 border rounded"
              data-testid="task-item"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.isCompleted}
                  onChange={() => toggleTask({ id: task._id })}
                  data-testid="toggle-button"
                  className="w-5 h-5"
                />
                <span className={task.isCompleted ? "line-through text-gray-500" : ""}>
                  {task.text}
                </span>
              </div>
              <button
                onClick={() => removeTask({ id: task._id })}
                data-testid="delete-button"
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
          {tasks.length === 0 && <p className="text-gray-500">No tasks yet.</p>}
        </ul>
      )}
    </main>
  );
}
