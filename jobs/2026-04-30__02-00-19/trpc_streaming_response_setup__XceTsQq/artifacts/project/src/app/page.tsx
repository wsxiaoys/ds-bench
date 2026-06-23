'use client';

import { trpc } from '@/utils/trpc';
import { useState } from 'react';

export default function Home() {
  const [streamedText, setStreamedText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);

  const streamWordsMutation = trpc.streamWords.useMutation({
    onSuccess: async (stream) => {
      setIsStreaming(true);
      setStreamedText('');
      
      for await (const word of stream) {
        setStreamedText((prev) => {
          if (prev === '') {
            return word;
          }
          return `${prev} ${word}`;
        });
      }
      
      setIsStreaming(false);
    },
  });

  const handleStream = () => {
    streamWordsMutation.mutate({});
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8">tRPC v11 Streaming Demo</h1>
        
        <div className="mb-8">
          <button
            onClick={handleStream}
            disabled={isStreaming}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? 'Streaming...' : 'Start Streaming'}
          </button>
        </div>

        <div className="text-2xl font-mono min-h-[3rem] p-4 bg-gray-100 rounded-lg">
          {streamedText || <span className="text-gray-400">Click the button to start streaming</span>}
        </div>

        {streamedText === 'Hello streaming world' && (
          <p className="mt-4 text-green-600 font-semibold">
            ✓ Streaming complete!
          </p>
        )}
      </div>
    </main>
  );
}