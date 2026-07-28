import { component$, useSignal, useStore, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";

// A structured representation of a single parsed log line.
// Kept as a plain object shape (not a class instance) so it can be
// safely serialized across the server$ streaming RPC boundary.
interface LogEntry {
  index: number;
  level: string;
  message: string;
}

// Stream the parsed log entries one at a time to the client.
//
// All file-system access happens *inside* this server$ callback so that:
//   1. It only ever runs on the server (server$ enforces this at the
//      framework level, but keeping the fs import local also guarantees
//      no server-only module is pulled into the client bundle).
//   2. The file is re-read from disk on every invocation, so edits made
//      to data/events.log between runs are always reflected.
export const streamLog = server$(async function* () {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const rawLog = await readFile(
    join(process.cwd(), "data", "events.log"),
    "utf-8",
  );
  const lines = rawLog.split("\n").filter((line) => line.trim().length > 0);

  let index = 0;
  for (const line of lines) {
    const [level, message] = line.split("|");
    // Yield a plain, serializable object -- not a class instance.
    const entry: LogEntry = { index, level, message };
    yield entry;
    index++;
    // Simulate a slow log source.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
});

export default component$(() => {
  const status = useSignal<"idle" | "streaming" | "done">("idle");
  const state = useStore<{ list: LogEntry[] }>({ list: [] });

  return (
    <div>
      <h1>Live Log Stream</h1>
      <button
        id="start"
        onClick$={$(async () => {
          status.value = "streaming";
          state.list = [];

          // streamLog() is an RPC call: awaiting it gives us back an
          // async iterable that yields each entry as it streams in from
          // the server, allowing us to render incrementally.
          const stream = await streamLog();
          for await (const entry of stream as AsyncIterable<LogEntry>) {
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
