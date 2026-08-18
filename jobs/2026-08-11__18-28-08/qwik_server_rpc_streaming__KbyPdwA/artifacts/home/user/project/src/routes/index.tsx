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

  // Read the current on-disk contents of data/events.log each time streaming starts
  const logPath = path.join(process.cwd(), "data", "events.log");
  const rawLog = fs.readFileSync(logPath, "utf-8");

  const lines = rawLog.split("\n");
  let index = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const firstPipe = trimmed.indexOf("|");
    if (firstPipe === -1) {
      continue;
    }
    const level = trimmed.substring(0, firstPipe);
    const message = trimmed.substring(firstPipe + 1);

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
          const stream = await streamLog();
          for await (const entry of stream) {
            state.list.push(entry);
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
