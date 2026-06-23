'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const utils = trpc.useUtils();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || isStreaming) return;

    setResponse('');
    setIsStreaming(true);

    try {
      // In tRPC v11, calling a generator procedure returns an AsyncIterable
      const iterable = await utils.client.chat.query(input);
      
      for await (const chunk of iterable) {
        setResponse((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">tRPC v11 Streaming Chat</h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            disabled={isStreaming}
          />
          <button
            id="chat-submit"
            type="submit"
            disabled={isStreaming || !input}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isStreaming ? 'Streaming...' : 'Send'}
          </button>
        </form>

        <div className="mt-6 p-4 border border-gray-200 rounded bg-gray-50 min-h-[100px] whitespace-pre-wrap text-black">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Response:</h2>
          <div id="chat-response">{response}</div>
        </div>
      </div>
    </div>
  );
}
