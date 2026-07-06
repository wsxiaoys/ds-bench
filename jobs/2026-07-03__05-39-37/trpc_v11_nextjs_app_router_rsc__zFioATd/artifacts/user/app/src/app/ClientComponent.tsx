'use client';

import { trpc } from '../utils/trpc';

export default function ClientComponent() {
  const { data, isLoading } = trpc.hello.useQuery({ name: 'Client' });

  return (
    <p id="client-data">
      {isLoading ? 'Loading...' : data}
    </p>
  );
}