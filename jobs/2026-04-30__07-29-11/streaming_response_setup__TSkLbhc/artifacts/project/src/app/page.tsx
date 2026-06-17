"use client";

import { useEffect, useState } from "react";

import { trpcClient } from "@/lib/trpc-client";

export default function Home() {
  const [words, setWords] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const stream = async () => {
      const response = await trpcClient.streamWords.query();

      for await (const word of response) {
        if (cancelled) {
          break;
        }

        setWords((current) => [...current, word]);
      }
    };

    stream().catch((error: unknown) => {
      console.error("Failed to stream words", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "42rem",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid rgba(127, 127, 127, 0.2)",
          background: "rgba(127, 127, 127, 0.08)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "0.75rem" }}>
          tRPC v11 streaming demo
        </p>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Streaming response</h1>
        <p style={{ fontSize: "1.25rem", lineHeight: 1.6 }}>{words.join(" ")}</p>
      </section>
    </main>
  );
}
