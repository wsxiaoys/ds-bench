'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function Page() {
  const [prompt, setPrompt] = useState('Hello, tRPC streaming!');
  const [chunks, setChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setChunks([]);
    setError(null);
    setIsStreaming(true);

    try {
      // `httpBatchStreamLink` makes the AsyncGenerator on the server
      // appear as an AsyncIterable on the client. We can `for await` it.
      const iterable = (await utils.client.chatStream.query({
        prompt,
      })) as unknown as AsyncIterable<string>;

      for await (const chunk of iterable) {
        setChunks((prev) => [...prev, chunk]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '40px 20px',
      }}
    >
      <h1 style={{ marginBottom: 8 }}>tRPC v11 Async Generator Streaming</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Streaming over standard HTTP via <code>httpBatchStreamLink</code>.
      </p>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt"
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #2a2f3a',
            background: '#11141b',
            color: '#e6e8ee',
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={isStreaming || prompt.trim().length === 0}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #2a2f3a',
            background: isStreaming ? '#1a1f2a' : '#3b82f6',
            color: '#fff',
            fontSize: 16,
            cursor: isStreaming ? 'not-allowed' : 'pointer',
          }}
        >
          {isStreaming ? 'Streaming…' : 'Send'}
        </button>
      </form>

      <section
        aria-live="polite"
        style={{
          marginTop: 24,
          padding: 20,
          minHeight: 160,
          borderRadius: 12,
          background: '#11141b',
          border: '1px solid #2a2f3a',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          fontSize: 16,
        }}
      >
        {chunks.length === 0 && !isStreaming && (
          <span style={{ opacity: 0.5 }}>The streamed response will appear here…</span>
        )}
        {chunks.join('')}
        {isStreaming && <span className="cursor">▍</span>}
      </section>

      {error && (
        <p style={{ marginTop: 16, color: '#f87171' }}>
          Error: {error}
        </p>
      )}
    </main>
  );
}
