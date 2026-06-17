'use client';

import { trpc } from '../utils/trpc';

export default function ClientComponent() {
  const hello = trpc.hello.useQuery({ name: 'Client' });

  if (!hello.data) return <p id="client-data">Loading...</p>;

  return <p id="client-data">{hello.data}</p>;
}
