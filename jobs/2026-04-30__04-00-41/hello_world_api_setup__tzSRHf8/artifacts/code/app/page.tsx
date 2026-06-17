'use client';

import { trpc } from '@/utils/trpc';

export default function Home() {
  const helloQuery = trpc.hello.useQuery('World');

  if (helloQuery.isLoading) {
    return <main>Loading...</main>;
  }

  if (helloQuery.error) {
    return <main>Error: {helloQuery.error.message}</main>;
  }

  return (
    <main>
      <h1>{helloQuery.data}</h1>
    </main>
  );
}
