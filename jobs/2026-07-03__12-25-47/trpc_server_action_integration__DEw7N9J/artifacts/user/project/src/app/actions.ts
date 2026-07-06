'use server';

import { caller } from '@/server/trpc';

export async function addMessageAction(text: string) {
  const result = await caller.addMessage({ text });
  return result;
}
