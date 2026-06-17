'use client';
import { trpc } from '@/trpc/client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [displayText, setDisplayText] = useState('');
  const chatStream = trpc.chatStream.useQuery('test prompt');

  useEffect(() => {
    if (!chatStream.data) return;
    
    let mounted = true;
    const streamText = async () => {
      let accumulatedText = '';
      for await (const chunk of chatStream.data) {
        if (!mounted) return;
        accumulatedText += chunk;
        setDisplayText(accumulatedText);
      }
    };
    
    streamText();
    
    return () => {
      mounted = false;
    };
  }, [chatStream.data]);

  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Streaming Response: {displayText || 'Loading...'}</p>
    </main>
  );
}
