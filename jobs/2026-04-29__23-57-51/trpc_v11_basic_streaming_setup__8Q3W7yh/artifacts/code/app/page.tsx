"use client";

import { trpc } from "@/trpc/react";

export default function Home() {
  const { data } = trpc.streamNumbers.useQuery();

  const numbers = Array.isArray(data) ? data : data !== undefined ? [data] : [];
  const output = numbers.join(", ");

  return (
    <div>
      <div id="stream-output">{output}</div>
    </div>
  );
}
