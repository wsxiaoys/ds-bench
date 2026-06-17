"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";

export default function Home() {
  const [input, setInput] = useState("Hello, this is a test of tRPC v11 streaming.");
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const utils = trpc.useUtils();

  const handleStream = async () => {
    setIsStreaming(true);
    setText("");

    try {
      const iterable = await utils.client.chatStream.query(input);
      for await (const chunk of iterable) {
        setText((prev) => prev + chunk);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-4">
      <h1 className="text-4xl font-bold">tRPC v11 Async Generator Streaming</h1>
      
      <div className="flex flex-col gap-2 w-full max-w-md">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border border-gray-300 rounded p-2 text-black"
          disabled={isStreaming}
        />
        <button
          onClick={handleStream}
          disabled={isStreaming || !input}
          className="bg-blue-500 text-white rounded p-2 hover:bg-blue-600 disabled:opacity-50"
        >
          {isStreaming ? "Streaming..." : "Start Stream"}
        </button>
      </div>

      <div className="w-full max-w-md min-h-[200px] border border-gray-300 rounded p-4 bg-gray-50 text-black">
        {text || <span className="text-gray-400">Streamed output will appear here...</span>}
      </div>
    </main>
  );
}
