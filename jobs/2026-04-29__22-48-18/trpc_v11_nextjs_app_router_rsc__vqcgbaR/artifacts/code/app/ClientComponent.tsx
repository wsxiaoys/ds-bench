'use client';

import { trpc } from '../utils/trpc';

export default function ClientComponent() {
  const { data, isLoading } = trpc.hello.useQuery({ name: 'Client' });
  
  if (isLoading) return <p id="client-data">Loading...</p>;

  return <p id="client-data">{data}</p>;
}
