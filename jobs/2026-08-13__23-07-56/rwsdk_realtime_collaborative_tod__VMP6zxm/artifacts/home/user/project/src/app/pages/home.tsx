"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import styles from "./todo.module.css";

export const Home = () => {
  const [todos, setTodos] = useSyncedState<string[]>([], "todos");
  const [inputText, setInputText] = useState("");

  const handleAdd = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setTodos((prev) => [...(prev || []), trimmed]);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAdd();
    }
  };

  const handleDelete = (indexToDelete: number) => {
    setTodos((prev) => (prev || []).filter((_, i) => i !== indexToDelete));
  };

  const handleClear = () => {
    setTodos([]);
  };

  const todoList = todos || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Collaborative To-Do</h1>
        <p className={styles.subtitle}>
          Realtime synchronized with RedwoodSDK
        </p>
      </header>

      <div className={styles.inputGroup}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
          className={styles.input}
          data-testid="todo-input"
        />
        <button
          onClick={handleAdd}
          className={styles.addButton}
          data-testid="todo-add"
        >
          Add
        </button>
      </div>

      {todoList.length === 0 ? (
        <div className={styles.emptyState}>
          No tasks yet. Add one above to get started!
        </div>
      ) : (
        <ul className={styles.todoList}>
          {todoList.map((todo, index) => (
            <li key={index} className={styles.todoItem}>
              <span data-testid="todo-item">{todo}</span>
              <button
                onClick={() => handleDelete(index)}
                className={styles.deleteButton}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {todoList.length > 0 && (
        <div className={styles.actions}>
          <span className={styles.count}>
            {todoList.length} {todoList.length === 1 ? "item" : "items"} left
          </span>
          <button onClick={handleClear} className={styles.clearButton}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
