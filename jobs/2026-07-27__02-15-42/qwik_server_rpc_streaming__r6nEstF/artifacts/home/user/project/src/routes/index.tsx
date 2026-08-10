import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A structured representation of a single parsed log line.
interface ViewEntry {
  index: number;
  level: string;
  message: string;
}

// Stream the parsed log entries one at a time to the client.
export const streamLog = server$(async function* () {
  const filePath = join(process.cwd(), "data", "events.log");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  let index = 0;
  for (const line of lines) {
    const parts = line.split("|");
    const level = parts[0];
    const message = parts.slice(1).join("|");
    yield { index, level, message } as ViewEntry;
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
          const result = await streamLog();
          for await (const entry of result) {
            state.list = [...state.list, entry];
          }
          status.value = "done";
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
