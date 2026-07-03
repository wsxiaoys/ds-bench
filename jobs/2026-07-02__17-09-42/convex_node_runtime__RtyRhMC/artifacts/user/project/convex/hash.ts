"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { createHash } from "crypto";

export const generate = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }) => {
    return createHash("sha256").update(text).digest("hex");
  },
});
