"use client";

import { useState, useTransition, useRef } from "react";
import { addMessage } from "./actions";

type Result = { success: true; message: string } | null;

/**
 * MessageForm – Client Component
 *
 * Renders a controlled form that calls the `addMessage` Server Action
 * and displays the echoed result returned by the tRPC mutation.
 */
export default function MessageForm() {
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const text = inputRef.current?.value.trim() ?? "";

    if (!text) {
      setError("Please enter a message.");
      return;
    }

    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const data = await addMessage(text);
        setResult(data);
        // Reset the input after a successful submission
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    });
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-6 text-xl font-semibold text-gray-800 dark:text-gray-100">
        Send a Message via tRPC
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label
          htmlFor="message"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Message
        </label>

        <input
          id="message"
          ref={inputRef}
          type="text"
          placeholder="Type something…"
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send Message"}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Success state */}
      {result?.success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          <p className="font-medium">✓ Message received by tRPC mutation</p>
          <p className="mt-1 break-all font-mono text-xs">{result.message}</p>
        </div>
      )}
    </div>
  );
}
