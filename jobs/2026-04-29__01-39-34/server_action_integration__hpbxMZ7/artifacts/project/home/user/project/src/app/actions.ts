"use server";

import { appRouter, createCallerFactory } from "@/server/trpc";

export type AddMessageState =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

const createCaller = createCallerFactory(appRouter);

export async function addMessageAction(
  _prevState: AddMessageState | null,
  formData: FormData
): Promise<AddMessageState> {
  const text = String(formData.get("text") ?? "").trim();

  if (!text) {
    return {
      success: false,
      message: "Text is required.",
    };
  }

  const caller = createCaller({});
  const result = await caller.addMessage({ text });

  return result;
}
