"use client";

import { trpc } from "@/trpc/client";

export default function Home() {
  const { data } = trpc.streamNumbers.useQuery();

  const text = Array.isArray(data) ? data.join(", ") : "";

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8">
      <div id="stream-output">{text}</div>
    </div>
  );
}
