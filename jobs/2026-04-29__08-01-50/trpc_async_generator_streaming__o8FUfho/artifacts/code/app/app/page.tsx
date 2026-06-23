'use client';

import { useState } from 'react';
import { trpc } from './trpc-provider';

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;

    setResponse('');
    setIsLoading(true);

    try {
      const iterable = await utils.client.chat.query(input);
      // Iterate over the async iterable returned by the streaming query
      for await (const chunk of iterable as any) {
        setResponse((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Failed to fetch stream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>tRPC v11 Streaming Chat</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          style={{ padding: '0.5rem', width: '300px', marginRight: '0.5rem' }}
          placeholder="Type a message..."
        />
        <button
          id="chat-submit"
          type="submit"
          disabled={isLoading || !input}
          style={{ padding: '0.5rem 1rem' }}
        >
          Send
        </button>
      </form>
      <div
        id="chat-response"
        style={{
          border: '1px solid #ccc',
          padding: '1rem',
          minHeight: '100px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {response}
      </div>
    </div>
  );
}
