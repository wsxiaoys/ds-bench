'use client';
import { trpc } from '@/trpc/client';
import { useEffect, useState } from 'react';

function Chat() {
  const [accumulated, setAccumulated] = useState("");
  const [lastData, setLastData] = useState<string | undefined>();

  const chat = trpc.chatStream.useQuery("Hello AI", {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  if (chat.data !== lastData) {
    if (chat.data) {
      setAccumulated((prev) => prev + chat.data);
    }
    setLastData(chat.data);
  }

  return (
    <div className="mt-4 p-4 border rounded">
      <h2 className="text-xl font-bold">Chat Stream</h2>
      <div className="mt-2 p-2 bg-gray-100 min-h-[50px] whitespace-pre-wrap">
        {accumulated}
      </div>
      {chat.isLoading && <p>Loading stream...</p>}
      {chat.isFetching && !chat.isLoading && <p>Streaming...</p>}
    </div>
  );
}

export default function Home() {
  return (
    <main className="p-4">
      <h1>tRPC AI Streaming Chat</h1>
      <Chat />
    </main>
  );
}
