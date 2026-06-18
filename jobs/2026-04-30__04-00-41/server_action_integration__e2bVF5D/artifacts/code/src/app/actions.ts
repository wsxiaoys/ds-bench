"use server";

import { caller } from "@/server/trpc";

export type AddMessageResult = {
  success: true;
  message: string;
};

export async function addMessageAction(
  _prevState: AddMessageResult | null,
  formData: FormData,
): Promise<AddMessageResult | null> {
  const text = formData.get("text");
  if (typeof text !== "string" || text.length === 0) {
    return null;
  }

  const result = await caller.addMessage({ text });
  return result;
}
