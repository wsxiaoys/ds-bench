"use client";

import { useCallback, useState } from "react";

import { trpcClient } from "@/src/trpc/client";

import styles from "./page.module.css";

const defaultPrompt = "Explain why AsyncGenerator streaming is useful in tRPC v11.";

export default function Home() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStream = useCallback(async () => {
    setIsStreaming(true);
    setStreamedText("");
    setError(null);

    try {
      const stream = await trpcClient.chatStream.query({ prompt });

      for await (const chunk of stream) {
        setStreamedText((current) => current + chunk);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Streaming failed");
    } finally {
      setIsStreaming(false);
    }
  }, [prompt]);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>tRPC v11 AsyncGenerator Streaming</p>
        <h1>Stream chat chunks over standard HTTP</h1>
        <p className={styles.description}>
          This demo uses <code>httpBatchStreamLink</code> on the client and an
          <code> AsyncGenerator</code> tRPC procedure on the server.
        </p>

        <label className={styles.label} htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className={styles.textarea}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
        />

        <button
          className={styles.button}
          onClick={startStream}
          disabled={isStreaming || !prompt.trim()}
          type="button"
        >
          {isStreaming ? "Streaming..." : "Start stream"}
        </button>

        <div className={styles.outputPanel}>
          <div className={styles.outputHeader}>
            <h2>Streamed response</h2>
            {isStreaming ? <span className={styles.badge}>live</span> : null}
          </div>

          <pre className={styles.output}>
            {streamedText || "The streamed chunks will appear here in real time."}
          </pre>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}
