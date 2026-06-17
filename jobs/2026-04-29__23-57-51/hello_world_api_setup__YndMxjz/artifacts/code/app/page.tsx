'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const { data, isLoading, error } = trpc.hello.useQuery('World');

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>tRPC v11 Hello World</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {data && <p style={{ fontSize: '1.5rem' }}>{data}</p>}
    </main>
  );
}
