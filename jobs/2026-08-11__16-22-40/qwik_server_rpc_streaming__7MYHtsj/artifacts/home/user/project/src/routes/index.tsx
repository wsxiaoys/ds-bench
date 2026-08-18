import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";

interface ViewEntry {
  index: number;
  level: string;
  message: string;
}

// Stream the parsed log entries one at a time to the client.
export const streamLog = server$(async function* () {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const rawLog = fs.readFileSync(path.join(process.cwd(), "data", "events.log"), "utf-8");
  const lines = rawLog.split("\n").filter((line) => line.trim().length > 0);
  let index = 0;
  for (const line of lines) {
    const [level, message] = line.split("|");
    yield { index, level, message };
    index++;
    // Simulate a slow log source.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
});

export default component$(() => {
  const status = useSignal<"idle" | "streaming" | "done">("idle");
  const state = useStore<{ list: ViewEntry[] }>({ list: [] });

  return (
    <div>
      <h1>Live Log Stream</h1>
      <button
        id="start"
        onClick$={$(async () => {
          status.value = "streaming";
          state.list = [];
          try {
            const stream = await streamLog();
            for await (const entry of stream) {
              state.list = [...state.list, entry];
            }
          } catch (err) {
            console.error("Streaming error:", err);
          } finally {
            status.value = "done";
          }
        })}
      >
        Start Stream
      </button>
      <p>
        Status: <span id="status">{status.value}</span>
      </p>
      <p>
        Received: <span id="count">{state.list.length}</span>
      </p>
      <p>
        Errors:{" "}
        <span id="errors">
          {state.list.filter((entry) => entry.level === "ERROR").length}
        </span>
      </p>
      <ul id="events">
        {state.list.map((entry) => (
          <li key={entry.index} data-idx={entry.index} data-level={entry.level}>
            {entry.level}: {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
});
