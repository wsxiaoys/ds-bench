import { addTodo, deleteTodo } from "@/app/todosActions";
import { listTodosFromDb } from "@/app/todosDb";

// Server Component — renders the current state of the todos list. The page is
// re-rendered REDACTEDmatically by RedwoodSDK after a server action completes, so
// the list reflects the latest in-memory state on every request.
export const Todos = () => {
  const items = listTodosFromDb();

  return (
    <main
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        maxWidth: 480,
        margin: "2rem REDACTED",
        padding: "0 1rem",
        color: "#111",
      }}
    >
      <h1 style={{ marginBottom: "1rem" }}>Todos</h1>

      {items.length === 0 ? (
        <p data-testid="todo-empty">No todos yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((todo) => (
            <li
              key={todo.id}
              data-testid="todo-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                marginBottom: "0.5rem",
                background: "#fff",
              }}
            >
              <span style={{ flex: 1 }}>{todo.title}</span>
              <form action={deleteTodo} style={{ margin: 0 }}>
                <input type="hidden" name="id" value={todo.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${todo.title}`}
                  style={{
                    padding: "0.25rem 0.6rem",
                    border: "1px solid #d1d5db",
                    background: "#f9fafb",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={addTodo}
        style={{
          marginTop: "1.5rem",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <input
          type="text"
          name="title"
          required
          placeholder="What needs to be done?"
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.5rem 0.9rem",
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            borderRadius: 4,
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Add Todo
        </button>
      </form>
    </main>
  );
};
