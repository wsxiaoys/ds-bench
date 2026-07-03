'use client';

import { useState } from 'react';
import { trpc } from './TRPCProvider';

export function ChatStream() {
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('Hello, world!');

  const handleStream = async () => {
    setStreamedText('');
    setIsStreaming(true);
    try {
      const iterable = await trpc.chatStream.subscribe(input);
      for await (const chunk of iterable) {
        if (typeof chunk === 'string') {
          setStreamedText((prev) => prev + chunk);
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>tRPC v11 Streaming Demo</h1>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          style={{
            padding: '0.5rem',
            width: '300px',
            marginRight: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <button
          onClick={handleStream}
          disabled={isStreaming}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isStreaming ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
          }}
        >
          {isStreaming ? 'Streaming...' : 'Start Stream'}
        </button>
      </div>
      <div
        style={{
          padding: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          minHeight: '200px',
          whiteSpace: 'pre-wrap',
          backgroundColor: '#f5f5f5',
        }}
      >
        {streamedText || 'Click "Start Stream" to begin...'}
      </div>
    </div>
  );
}
