"use client";

import { useActionState } from "react";
import { addMessageAction, type AddMessageResult } from "./actions";

export function MessageForm() {
  const [state, formAction, isPending] = useActionState<
    AddMessageResult | null,
    FormData
  >(addMessageAction, null);

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="text" className="text-sm font-medium">
          Message
        </label>
        <input
          id="text"
          name="text"
          type="text"
          required
          placeholder="Type a message..."
          className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 bg-transparent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-foreground text-background rounded-md px-4 py-2 font-medium disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send Message"}
        </button>
      </form>

      {state && (
        <div
          className="rounded-md border border-green-500 bg-green-50 dark:bg-green-950 p-4"
          data-testid="result"
        >
          <p className="text-sm">
            <span className="font-semibold">Success:</span>{" "}
            {String(state.success)}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Message:</span> {state.message}
          </p>
        </div>
      )}
    </div>
  );
}
