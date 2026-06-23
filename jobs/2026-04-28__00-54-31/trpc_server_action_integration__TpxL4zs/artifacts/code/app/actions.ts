'use server';

import { caller } from '@/server';

export async function addMessageAction(text: string) {
  try {
    const result = await caller.addMessage({ text });
    return result;
  } catch (error) {
    console.error('Error in addMessageAction:', error);
    throw new Error('Failed to add message');
  }
}
