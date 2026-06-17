'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const hello = trpc.hello.useQuery('World');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">
        {hello.data ? hello.data : 'Loading...'}
      </h1>
    </main>
  );
}
