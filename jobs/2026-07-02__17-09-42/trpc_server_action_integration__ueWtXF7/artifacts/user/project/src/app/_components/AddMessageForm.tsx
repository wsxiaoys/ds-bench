"use client";

import { useState, useTransition } from "react";
import { addMessageAction } from "../actions";

type FormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; error: string };

export function AddMessageForm() {
  const [text, setText] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) {
      setState({ status: "error", error: "Please enter a message." });
      return;
    }

    startTransition(async () => {
      const result = await addMessageAction({ text });
      if (result.ok) {
        setState({
          status: "success",
          message: result.message,
        });
        setText("");
      } else {
        setState({ status: "error", error: result.error });
      }
    });
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label
          htmlFor="message"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Your message
        </label>
        <input
          id="message"
          name="message"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type something..."
          disabled={isPending}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Sending..." : "Send"}
        </button>
      </form>

      {state.status === "success" && (
        <div
          role="status"
          className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          <p className="font-semibold">Server response:</p>
          <p className="mt-1">{state.message}</p>
        </div>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-semibold">Error:</p>
          <p className="mt-1">{state.error}</p>
        </div>
      )}
    </div>
  );
}