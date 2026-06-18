"use server";

import { createCaller } from "@/server/caller";

/**
 * Server Action that calls the `addMessage` mutation via the tRPC caller.
 *
 * This is a "use server" function, meaning it runs exclusively on the server.
 * It uses `createCallerFactory` to create a caller that invokes the tRPC
 * procedure directly without going over HTTP.
 */
export async function addMessageAction(text: string) {
  const caller = createCaller({});
  const result = await caller.addMessage({ text });
  return result;
}