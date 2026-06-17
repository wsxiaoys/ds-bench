"use server";

import { createCaller } from "@/server/trpc";

/**
 * Server Action: addMessage
 *
 * Creates a tRPC caller via `createCallerFactory` and invokes the
 * `addMessage` mutation entirely on the server – no HTTP round-trip.
 *
 * @param text - The message text submitted from the client form.
 * @returns    The procedure result: { success: true, message: string }
 */
export async function addMessage(
  text: string,
): Promise<{ success: true; message: string }> {
  // Instantiate a server-side caller (context can be extended later,
  // e.g. to forward cookies / auth headers).
  const caller = createCaller({});

  // Directly invoke the tRPC mutation – fully type-safe.
  const result = await caller.addMessage({ text });

  return result;
}
