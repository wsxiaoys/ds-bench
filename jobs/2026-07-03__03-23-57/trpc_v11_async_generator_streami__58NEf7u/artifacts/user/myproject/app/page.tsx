'use client';

import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function Home() {
  const trpc = useTRPC();

  // Input states
  const [inputText, setInputText] = useState('Explain tRPC v11 streaming');
  const [queryInput, setQueryInput] = useState('');

  // Vanilla client streaming states
  const [vanillaData, setVanillaData] = useState<string[]>([]);
  const [isVanillaLoading, setIsVanillaLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'useQuery' | 'vanilla'>('useQuery');

  // React Query Hook stream
  const {
    data: queryData,
    refetch,
    isFetching: isQueryFetching,
    error: queryError,
  } = useQuery(
    trpc.chatStream.queryOptions(queryInput, {
      enabled: queryInput !== '',
    })
  );

  // Triggering the useQuery stream
  const handleQueryStream = () => {
    setActiveMethod('useQuery');
    setQueryInput(inputText);
    // If the input is already the same, we need to manually trigger a refetch
    if (queryInput === inputText) {
      refetch();
    }
  };

  // Triggering the Vanilla Client stream
  const handleVanillaStream = async () => {
    setActiveMethod('vanilla');
    setVanillaData([]);
    setIsVanillaLoading(true);
    try {
      // Direct call to the tRPC client returns an AsyncGenerator / Iterable
      const iterable = await trpc.chatStream.query(inputText);
      for await (const chunk of iterable) {
        setVanillaData((prev) => [...prev, chunk]);
      }
    } catch (err) {
      console.error('Vanilla stream error:', err);
    } finally {
      setIsVanillaLoading(false);
    }
  };

  // Combined status and data display based on active method
  const isStreaming = activeMethod === 'useQuery' ? isQueryFetching : isVanillaLoading;
  const currentData = activeMethod === 'useQuery' ? queryData : vanillaData;
  const displayedText = currentData?.join('') || '';
  const error = activeMethod === 'useQuery' ? queryError : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-REDACTED space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-indigo-600 sm:text-5xl">
            tRPC v11 Streaming
          </h1>
          <p className="text-lg text-zinc-600 max-w-xl mx-REDACTED">
            Native HTTP streaming using <code className="font-mono bg-zinc-200 px-1.5 py-0.5 rounded text-sm font-semibold">AsyncGenerator</code> and <code className="font-mono bg-zinc-200 px-1.5 py-0.5 rounded text-sm font-semibold">httpBatchStreamLink</code>.
          </p>
        </div>

        {/* Input & Settings card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 space-y-6">
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-semibold text-zinc-700 block">
              Prompt Input
            </label>
            <input
              type="text"
              id="prompt"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type something to stream..."
              disabled={isStreaming}
              className="w-full px-4 py-3 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:bg-zinc-100 transition duration-150"
            />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleQueryStream}
              disabled={isStreaming || !inputText.trim()}
              className={`flex items-center justify-center gap-2 px-6 py-3.5 border rounded-xl font-medium transition duration-150 ${
                activeMethod === 'useQuery' && isStreaming
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-indigo-600 border-transparent text-white hover:bg-indigo-700 active:bg-indigo-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {activeMethod === 'useQuery' && isStreaming ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-indigo-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Streaming via useQuery...
                </>
              ) : (
                'Stream with useQuery'
              )}
            </button>

            <button
              onClick={handleVanillaStream}
              disabled={isStreaming || !inputText.trim()}
              className={`flex items-center justify-center gap-2 px-6 py-3.5 border rounded-xl font-medium transition duration-150 ${
                activeMethod === 'vanilla' && isStreaming
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-600 border-transparent text-white hover:bg-emerald-700 active:bg-emerald-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {activeMethod === 'vanilla' && isStreaming ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Streaming via Vanilla...
                </>
              ) : (
                'Stream with Vanilla Client'
              )}
            </button>
          </div>
        </div>

        {/* Streaming output display */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          {/* Status bar */}
          <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-zinc-500">Method:</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                activeMethod === 'useQuery' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeMethod === 'useQuery' ? 'useQuery (React Query)' : 'Vanilla (for await...of)'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-500">Status:</span>
              {isStreaming ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                  Streaming
                </span>
              ) : displayedText ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800">
                  Idle
                </span>
              )}
            </div>
          </div>

          {/* Text Output Terminal */}
          <div className="p-6 bg-zinc-950 text-zinc-100 font-mono text-sm min-h-[300px] max-h-[500px] overflow-y-REDACTED whitespace-pre-wrap rounded-b-2xl shadow-inner scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {displayedText ? (
              <div className="leading-relaxed">
                {displayedText}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-1 animate-ping" />
                )}
              </div>
            ) : error ? (
              <div className="text-red-400">
                Error loading stream: {error.message}
              </div>
            ) : (
              <div className="text-zinc-500 italic flex items-center justify-center min-h-[250px]">
                Click one of the stream buttons above to start receiving real-time chunks.
              </div>
            )}
          </div>
        </div>

        {/* Technical Explainer */}
        <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 space-y-4">
          <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
            💡 How it works under the hood
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-indigo-900/80 leading-relaxed">
            <li>
              <strong>Server-side Generator:</strong> The procedure <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">chatStream</code> is defined as an <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">async function*</code> on the tRPC router, yielding text chunks.
            </li>
            <li>
              <strong>httpBatchStreamLink:</strong> Configured on the client, this link REDACTEDmatically sets the <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">trpc-accept: application/jsonl</code> header and processes the chunked HTTP response stream.
            </li>
            <li>
              <strong>React Query Integration:</strong> In tRPC v11, the <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">useQuery</code> hook receives the streamed chunks as an array in the <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">data</code> property, which React re-renders in real-time as chunks arrive.
            </li>
            <li>
              <strong>Vanilla Client:</strong> Alternatively, direct calls to the vanilla tRPC client return a native JavaScript <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">AsyncGenerator</code> which can be consumed using a standard <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-950">for await...of</code> loop.
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
