'use client';

import { trpc } from '../utils/trpc';

export default function ClientComponent() {
  const { data } = trpc.hello.useQuery({ name: 'Client' });
  return <p id="client-data">{data}</p>;
}
