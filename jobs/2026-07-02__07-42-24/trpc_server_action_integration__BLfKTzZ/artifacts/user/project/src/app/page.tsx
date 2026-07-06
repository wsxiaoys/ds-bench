"use client";

import { useState } from "react";
import { addMessageAction } from "./actions";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await addMessageAction(text);
      setResult(res);
      setText("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            tRPC v11 + Server Actions
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
            Submit a message to securely call the backend procedure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              Message Text
            </label>
            <input
              type="text"
              id="message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message here..."
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 transition-all"
          >
            {isLoading ? "Submitting..." : "Send Message"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-lg bg-emerald-50 p-5 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
              Response Received:
            </h2>
            <div className="mt-2 space-y-1 text-xs font-mono text-emerald-900 dark:text-emerald-300">
              <p>
                <span className="font-bold">success:</span> {result.success ? "true" : "false"}
              </p>
              <p>
                <span className="font-bold">message:</span> {result.message}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
