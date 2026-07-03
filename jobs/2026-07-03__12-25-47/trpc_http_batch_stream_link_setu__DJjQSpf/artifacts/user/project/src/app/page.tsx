'use client';
import { useEffect, useState } from 'react';
import { trpc } from '@/trpc/client';

function ChatStream() {
  const [text, setText] = useState('');
  const hello = trpc.hello.useQuery('tRPC');
  const chatStream = trpc.chatStream.useQuery('Say hello', {
    onData: (chunk) => {
      setText((prev) => prev + chunk);
    },
  });

  useEffect(() => {
    if (chatStream.error) {
      // eslint-disable-next-line no-console
      console.error(chatStream.error);
    }
  }, [chatStream.error]);

  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <p>Status: {hello.data ? hello.data : 'Loading...'}</p>
      <p>Stream: {text}</p>
    </main>
  );
}

export default function Home() {
  return <ChatStream />;
}
