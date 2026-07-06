"use server";

import { TRPCClientError } from "@trpc/client";
import { trpcCaller } from "@/server/caller";

export type AddMessageInput = {
  text: string;
};

export type AddMessageResult =
  | { ok: true; success: boolean; message: string }
  | { ok: false; error: string };

/**
 * Next.js Server Action that calls the tRPC `addMessage` mutation
 * through the server-side caller. Server Actions are async functions
 * that run on the server, so this is the ideal place to invoke tRPC
 * procedures directly without needing an HTTP round-trip.
 */
export async function addMessageAction(
  input: AddMessageInput,
): Promise<AddMessageResult> {
  try {
    const caller = await trpcCaller();
    const result = await caller.messages.addMessage({ text: input.text });

    return {
      ok: true,
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    if (error instanceof TRPCClientError) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Unknown server error",
    };
  }
}