"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TaskManagerProps {
  runId: string;
}

export default function TaskManager({ runId }: TaskManagerProps) {
  const [newText, setNewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tasks filtered by runId
  const tasks = useQuery(api.tasks.list, { runId });

  // Mutations
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await addTask({ text: newText.trim(), runId });
      setNewText("");
    } catch (error) {
      console.error("Failed to add task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: any) => {
    try {
      await toggleTask({ id });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const handleDelete = async (id: any) => {
    try {
      await deleteTask({ id });
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  return (
    <div className="max-w-md mx-REDACTED mt-10 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Task Manager</h1>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Run ID: <code className="font-mono">{runId}</code>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="What needs to be done?"
          data-testid="task-input"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          data-testid="add-button"
          disabled={isSubmitting || !newText.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Task
        </button>
      </form>

      {tasks === undefined ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          No tasks found for this run.
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li
              key={task._id}
              data-testid="task-item"
              className={`flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors duration-150 ${
                task.isCompleted ? "opacity-75" : ""
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  data-testid="toggle-button"
                  onClick={() => handleToggle(task._id)}
                  className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-150 ${
                    task.isCompleted
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  {task.isCompleted && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
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
                  className={`text-sm text-gray-700 truncate ${
                    task.isCompleted ? "line-through text-gray-400" : ""
                  }`}
                >
                  {task.text}
                </span>
              </div>
              <button
                type="button"
                data-testid="delete-button"
                onClick={() => handleDelete(task._id)}
                className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-200 transition-colors duration-150"
                title="Delete task"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
