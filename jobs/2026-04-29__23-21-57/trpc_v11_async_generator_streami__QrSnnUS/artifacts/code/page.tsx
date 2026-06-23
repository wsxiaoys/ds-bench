'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export default function Home() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const chatStream = trpc.chatStream.useMutation();

  const handleStream = async () => {
    if (!input.trim()) return;

    setIsStreaming(true);
    setOutput('');

    try {
      const inputStream = chatStream.mutateAsync(input);
      
      for await (const chunk of inputStream) {
        setOutput((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Stream error:', error);
      setOutput('Error occurred during streaming');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">
            tRPC v11 Streaming Demo
          </h1>
          <p className="text-gray-600">
            Real-time streaming with AsyncGenerator and httpBatchStreamLink
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="input"
              className="block text-sm font-medium text-gray-700"
            >
              Enter text to stream:
            </label>
            <textarea
              id="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type something here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isStreaming}
            />
          </div>

          <button
            onClick={handleStream}
            disabled={isStreaming || !input.trim()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? 'Streaming...' : 'Start Streaming'}
          </button>

          {output && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Streamed Output:
              </label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-md min-h-[100px] whitespace-pre-wrap">
                <span className="text-gray-900">{output}</span>
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>
            This demo uses tRPC v11 with AsyncGenerator for streaming responses
          </p>
          <p className="mt-1">
            Try typing a sentence and watch it stream back word by word!
          </p>
        </div>
      </div>
    </div>
  );
}