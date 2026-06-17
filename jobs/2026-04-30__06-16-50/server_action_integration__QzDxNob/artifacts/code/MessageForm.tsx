"use client";

import { useState, useTransition } from "react";
import { addMessageAction } from "@/app/actions";

export function MessageForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const text = formData.get("text") as string;

    if (!text || !text.trim()) {
      setError("Please enter a message.");
      setMessage(null);
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await addMessageAction(text);
        setMessage(result.message);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
        setMessage(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <form
        action={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="text"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Message
          </label>
          <input
            id="text"
            name="text"
            type="text"
            placeholder="Type your message..."
            className="h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-300"
            disabled={isPending}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Sending..." : "Send Message"}
        </button>
      </form>

      {message && (
        <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Success!
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            {message}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Error
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}