"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || isStreaming) return;

    setResponse("");
    setIsStreaming(true);

    try {
      const iterable = await trpc.chat.query(input);
      for await (const chunk of iterable as AsyncIterable<string>) {
        setResponse((prev) => prev + chunk);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 gap-6">
      <h1 className="text-3xl font-bold">tRPC v11 Streaming Chat</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-xl"
      >
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="border border-gray-300 rounded px-3 py-2"
          disabled={isStreaming}
        />
        <button
          id="chat-submit"
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:bg-gray-400"
          disabled={isStreaming || !input}
        >
          {isStreaming ? "Streaming..." : "Send"}
        </button>
      </form>
      <div
        id="chat-response"
        className="w-full max-w-xl min-h-[100px] border border-gray-300 rounded p-4 whitespace-pre-wrap"
      >
        {response}
      </div>
    </main>
  );
}
