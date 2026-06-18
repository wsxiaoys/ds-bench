'use server';

import { createCaller } from '@/server/trpc';

export async function addMessageAction(text: string) {
  const caller = createCaller({});
  return await caller.addMessage({ text });
}
