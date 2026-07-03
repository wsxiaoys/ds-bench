"use client";

import { trpc } from "./_trpc/client";

/**
 * Root page that calls the streaming `streamWords` procedure and
 * displays the words as they arrive, joined with a space.
 *
 * With tRPC v11 + `httpBatchStreamLink`, an async-generator
 * procedure returns an AsyncIterable on the client. The react-query
 * integration in tRPC v11 accumulates every yielded value into an
 * array and exposes it as `query.data`. The component re-renders
 * after each chunk is appended.
 */
export default function Home() {
  const query = trpc.chat.streamWords.useQuery(undefined, {
    staleTime: Infinity,
  });

  // `query.data` starts as `[]` and grows to
  // `["Hello", "streaming", "world"]` as each chunk streams in.
  const words: string[] = Array.isArray(query.data) ? query.data : [];

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>tRPC v11 Streaming Demo</h1>
      <div
        id="chat-output"
        data-testid="chat-output"
        style={{
          marginTop: "1rem",
          padding: "1rem",
          border: "1px solid #ccc",
          borderRadius: "8px",
          minHeight: "2rem",
          fontSize: "1.25rem",
        }}
      >
        {words.join(" ")}
      </div>
    </main>
  );
}