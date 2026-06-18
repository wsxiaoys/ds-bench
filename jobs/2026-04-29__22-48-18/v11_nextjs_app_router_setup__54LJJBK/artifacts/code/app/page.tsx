"use client";

import { trpc } from "./Provider";

export default function Home() {
  const hello = trpc.hello.useQuery("tRPC v11");

  if (!hello.data) return <div>Loading...</div>;

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <div id="result" className="text-2xl font-bold dark:text-white">
        {hello.data}
      </div>
    </div>
  );
}
