"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import styles from "./page.module.css";

export default function Home() {
  const runId = useMemo(
    () => process.env.NEXT_PUBLIC_ZEALT_RUN_ID ?? "local",
    []
  );
  const [text, setText] = useState("");
  const tasks = useQuery(api.tasks.list, { runId }) ?? [];
  const addTask = useMutation(api.tasks.add);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      return;
    }
    await addTask({ text, runId });
    setText("");
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Task Manager</h1>
            <p>Run ID: {runId}</p>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            data-testid="task-input"
            type="text"
            placeholder="Add a task"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button className={styles.addButton} data-testid="add-button" type="submit">
            Add Task
          </button>
        </form>

        <ul className={styles.list}>
          {tasks.length === 0 ? (
            <li className={styles.empty}>No tasks yet.</li>
          ) : (
            tasks.map((task) => (
              <li
                key={task._id}
                className={styles.task}
                data-testid="task-item"
              >
                <label className={styles.taskLabel}>
                  <input
                    data-testid="toggle-button"
                    type="checkbox"
                    checked={task.isCompleted}
                    onChange={() => toggleTask({ id: task._id, runId })}
                  />
                  <span
                    className={
                      task.isCompleted ? styles.completedText : styles.taskText
                    }
                  >
                    {task.text}
                  </span>
                </label>
                <button
                  className={styles.deleteButton}
                  data-testid="delete-button"
                  type="button"
                  onClick={() => removeTask({ id: task._id, runId })}
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
