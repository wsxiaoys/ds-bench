"use client";

import { trpc } from "@/trpc/react";

function StreamNumbers() {
  const { data, isLoading } = trpc.streamNumbers.useQuery();
  const output = data?.join(", ") ?? "";

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">tRPC Stream Output</h1>
      <div id="stream-output" className="text-lg">
        {output || (isLoading ? "Loading..." : "")}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <StreamNumbers />
    </div>
  );
}
