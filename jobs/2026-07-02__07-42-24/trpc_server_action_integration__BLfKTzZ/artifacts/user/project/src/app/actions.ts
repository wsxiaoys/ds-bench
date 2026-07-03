"use server";

import { createCaller } from "@/server/trpc";

export async function addMessageAction(text: string) {
  if (!text) {
    throw new Error("Text is required");
  }

  // Create a server-side caller
  const caller = createCaller({});

  // Call the tRPC mutation
  const result = await caller.addMessage({ text });
  
  return result;
}
