"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export default function Home() {
  const runId = process.env.NEXT_PUBLIC_ZEALT_RUN_ID || "default";
  const tasks = useQuery(api.tasks.getTasksByRunId, { runId });
  const createTask = useMutation(api.tasks.createTask);
  const toggleTask = useMutation(api.tasks.toggleTask);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const [newTaskText, setNewTaskText] = useState("");

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    await createTask({ text: trimmed, runId });
    setNewTaskText("");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center py-16 px-8 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50 mb-8">
          Task Manager
        </h1>

        <form onSubmit={handleAddTask} className="flex w-full gap-2 mb-8">
          <input
            data-testid="task-input"
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Enter a new task..."
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:text-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            data-testid="add-button"
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </form>

        <div className="w-full flex flex-col gap-3">
          {tasks === undefined ? (
            <p className="text-zinc-500 text-sm">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-zinc-500 text-sm">No tasks yet. Add one above!</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                data-testid="task-item"
                className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-3"
              >
                <button
                  data-testid="toggle-button"
                  onClick={() => toggleTask({ id: task._id })}
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    task.isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-zinc-400 dark:border-zinc-500"
                  }`}
                  aria-label={task.isCompleted ? "Mark as incomplete" : "Mark as complete"}
                >
                  {task.isCompleted && (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    task.isCompleted
                      ? "line-through text-zinc-400 dark:text-zinc-600"
                      : "text-black dark:text-zinc-50"
                  }`}
                >
                  {task.text}
                </span>
                <button
                  data-testid="delete-button"
                  onClick={() => deleteTask({ id: task._id })}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}