'use server';

import { serverCaller } from '@/server/trpc';

export async function addMessageAction(text: string) {
  try {
    const result = await serverCaller.addMessage({ text });
    return result;
  } catch (error) {
    console.error('Error in addMessageAction:', error);
    return {
      success: false,
      message: 'Failed to add message',
    };
  }
}