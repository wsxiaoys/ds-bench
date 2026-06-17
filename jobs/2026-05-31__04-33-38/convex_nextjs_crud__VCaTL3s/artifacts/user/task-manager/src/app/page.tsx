"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function Home() {
  const runId = process.env.NEXT_PUBLIC_ZEALT_RUN_ID || "default";
  const tasks = useQuery(api.tasks.list, { runId });
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const deleteTask = useMutation(api.tasks.remove);

  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addTask({ text: newTaskText, runId });
    setNewTaskText("");
  };

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Task Manager (Run ID: {runId})</h1>

      <form onSubmit={handleAddTask} className="flex gap-2 mb-8">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Enter a task..."
          className="flex-1 border p-2 rounded text-black"
          data-testid="task-input"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          data-testid="add-button"
        >
          Add Task
        </button>
      </form>

      <ul className="space-y-4">
        {tasks === undefined ? (
          <li>Loading...</li>
        ) : tasks.length === 0 ? (
          <li>No tasks found.</li>
        ) : (
          tasks.map((task) => (
            <li
              key={task._id}
              className="flex items-center justify-between border p-4 rounded bg-white shadow-sm text-black"
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
                onClick={() => deleteTask({ id: task._id })}
                className="text-red-500 hover:text-red-700 font-medium"
                data-testid="delete-button"
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
