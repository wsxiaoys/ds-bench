"use server";

import { appRouterCaller } from "@/server/trpc";

export type AddMessageActionState = {
  success: boolean;
  message: string;
};

export async function addMessageAction(
  _previousState: AddMessageActionState,
  formData: FormData,
): Promise<AddMessageActionState> {
  const text = formData.get("text");

  if (typeof text !== "string") {
    return {
      success: false,
      message: "Please provide a valid message.",
    };
  }

  try {
    const result = await appRouterCaller.addMessage({ text });

    return result;
  } catch {
    return {
      success: false,
      message: "Unable to add the message.",
    };
  }
}
