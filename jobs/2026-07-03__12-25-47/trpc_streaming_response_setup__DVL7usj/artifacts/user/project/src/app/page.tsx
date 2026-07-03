'use client';

import { trpc } from '@/trpc/client';

export default function Home() {
  const query = trpc.streamWords.useQuery();
  const words = query.data ?? [];

  return (
    <main>
      <h1>tRPC Streaming Output</h1>
      <div id="chat-output">{words.join(' ')}</div>
    </main>
  );
}
