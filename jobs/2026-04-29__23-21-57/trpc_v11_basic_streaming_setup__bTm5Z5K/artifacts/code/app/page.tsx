"use client";

import { trpc } from "@/client/trpc";
import { useState, useEffect } from "react";

export default function Home() {
  const [output, setOutput] = useState<string>("");
  const { data } = trpc.streamNumbers.useQuery();

  useEffect(() => {
    if (data) {
      const processStream = async () => {
        const numbers: number[] = [];
        for await (const num of data) {
          numbers.push(num);
        }
        setOutput(numbers.join(", "));
      };
      processStream();
    }
  }, [data]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            tRPC v11 Streaming
          </h1>
          <div
            id="stream-output"
            className="text-lg text-zinc-600 dark:text-zinc-400"
          >
            {output || "Loading..."}
          </div>
        </div>
      </main>
    </div>
  );
}