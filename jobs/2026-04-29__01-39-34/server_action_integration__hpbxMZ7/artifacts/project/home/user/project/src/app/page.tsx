"use client";

import { useActionState } from "react";

import { addMessageAction, type AddMessageState } from "./actions";

const initialState: AddMessageState | null = null;

export default function Home() {
  const [state, formAction, isPending] = useActionState(
    addMessageAction,
    initialState
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-900">
      <main className="flex w-full max-w-xl flex-col gap-8 rounded-2xl bg-white p-10 shadow-lg">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            tRPC v11 + Server Actions
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Send a message to the server
          </h1>
          <p className="text-base text-zinc-600">
            This form calls a server action that invokes the tRPC addMessage
            mutation via createCallerFactory.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <label className="text-sm font-medium text-zinc-700" htmlFor="text">
            Message
          </label>
          <input
            id="text"
            name="text"
            placeholder="Type something..."
            className="rounded-lg border border-zinc-200 px-4 py-3 text-base text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            required
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={isPending}
          >
            {isPending ? "Sending..." : "Send message"}
          </button>
        </form>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {state ? (
            <p>
              {state.success
                ? `✅ Server replied: ${state.message}`
                : `⚠️ ${state.message}`}
            </p>
          ) : (
            <p>Submit the form to see the server response.</p>
          )}
        </div>
      </main>
    </div>
  );
}
