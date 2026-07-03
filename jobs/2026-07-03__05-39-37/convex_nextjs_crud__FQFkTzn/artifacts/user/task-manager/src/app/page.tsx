"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, FormEvent } from "react";

export default function Home() {
  const runId = process.env.NEXT_PUBLIC_RUN_ID;
  const tasks = useQuery(api.tasks.get, runId ? { runId } : "skip");
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const deleteTask = useMutation(api.tasks.remove);

  const [newTaskText, setNewTaskText] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text || !runId) return;
    await addTask({ text, runId });
    setNewTaskText("");
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-start p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
          Task Manager
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Run ID: {runId}
        </p>

        {/* Add task form */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input
            data-testid="task-input"
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
          <button
            data-testid="add-button"
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add
          </button>
        </form>

        {/* Task list */}
        <ul className="space-y-2">
          {tasks === undefined ? (
            <li className="text-center text-gray-500 py-4">Loading tasks...</li>
          ) : tasks.length === 0 ? (
            <li className="text-center text-gray-500 py-4">
              No tasks yet. Add one above!
            </li>
          ) : (
            tasks.map((task) => (
              <li
                key={task._id}
                data-testid="task-item"
                className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
              >
                <button
                  data-testid="toggle-button"
                  onClick={() => toggleTask({ id: task._id })}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    task.isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                  aria-label={task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                >
                  {task.isCompleted && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 ${
                    task.isCompleted ? "line-through text-gray-400" : "text-gray-900"
                  }`}
                >
                  {task.text}
                </span>
                <button
                  data-testid="delete-button"
                  onClick={() => deleteTask({ id: task._id })}
                  className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                  aria-label="Delete task"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}