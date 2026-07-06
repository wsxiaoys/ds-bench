"use client";

import { trpc } from "@/utils/trpc";

export default function Home() {
  const hello = trpc.hello.useQuery("World");

  if (hello.error) {
    return <div>Error: {hello.error.message}</div>;
  }

  if (hello.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>{hello.data}</p>
    </div>
  );
}