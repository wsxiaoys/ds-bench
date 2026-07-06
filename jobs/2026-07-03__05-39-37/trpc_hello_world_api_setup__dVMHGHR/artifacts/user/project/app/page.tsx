"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  // Call the hello endpoint with the input "World"
  const hello = trpc.hello.useQuery("World");

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: 16,
      }}
    >
      <h1>tRPC v11 + Next.js App Router</h1>
      {hello.isLoading ? (
        <p>Loading…</p>
      ) : hello.isError ? (
        <p style={{ color: "crimson" }}>Error: {hello.error.message}</p>
      ) : (
        <p style={{ fontSize: "1.5rem" }}>{hello.data}</p>
      )}
    </main>
  );
}