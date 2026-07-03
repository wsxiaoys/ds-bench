'use client';

import { useState } from 'react';
import { trpc } from '@/app/_trpc/client';
import styles from './StreamChat.module.css';

type StreamInput = { prompt: string };

export function StreamChat() {
  const [prompt, setPrompt] = useState('Tell me about tRPC v11 streaming');
  const [streamInput, setStreamInput] = useState<StreamInput | null>(null);
  const [output, setOutput] = useState('');

  trpc.chatStream.useSubscription(streamInput as StreamInput, {
    enabled: streamInput !== null,
    onData: (chunk) => {
      // Append each chunk to the output as it arrives in real-time
      setOutput((prev) => prev + chunk);
    },
    onError: (err) => {
      setOutput((prev) => `${prev}\n\n[error] ${err.message}`);
      setStreamInput(null);
    },
    onComplete: () => {
      setStreamInput(null);
    },
  });

  const handleStream = () => {
    setOutput('');
    if (!prompt.trim()) return;
    // Setting a fresh object identity ensures the subscription restarts
    setStreamInput({ prompt });
  };

  const handleCancel = () => {
    setStreamInput(null);
  };

  const isStreaming = streamInput !== null;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>tRPC v11 AsyncGenerator Streaming</h1>

      <label className={styles.label} htmlFor="prompt">
        Prompt
      </label>
      <input
        id="prompt"
        className={styles.input}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type a prompt..."
        disabled={isStreaming}
      />

      <div className={styles.buttonRow}>
        <button
          className={styles.button}
          onClick={handleStream}
          disabled={isStreaming || !prompt.trim()}
        >
          {isStreaming ? 'Streaming...' : 'Start Stream'}
        </button>
        <button
          className={styles.buttonSecondary}
          onClick={handleCancel}
          disabled={!isStreaming}
        >
          Cancel
        </button>
      </div>

      <div className={styles.outputLabel}>Streamed output (live)</div>
      <pre className={styles.output}>
        <code>
          {output}
          {isStreaming && <span className={styles.cursor}>▍</span>}
        </code>
      </pre>
    </div>
  );
}