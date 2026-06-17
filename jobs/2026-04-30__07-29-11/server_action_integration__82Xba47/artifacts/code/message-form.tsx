"use client";

import { useActionState } from "react";

import {
  addMessageAction,
  type AddMessageActionState,
} from "@/app/actions";

const initialState: AddMessageActionState = {
  success: false,
  message: "Submit the form to call the tRPC mutation from a Server Action.",
};

export function MessageForm() {
  const [state, formAction, isPending] = useActionState(
    addMessageAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Message text
        <input
          type="text"
          name="text"
          required
          placeholder="Type a message"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? "Sending..." : "Send message"}
      </button>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">
          {state.success ? "Mutation result" : "Status"}
        </p>
        <p className="mt-1 break-words">{state.message}</p>
      </div>
    </form>
  );
}
