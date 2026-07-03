"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const generate = action({
  args: {
    text: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args): Promise<string> => {
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(args.text).digest("hex");
    return hash;
  },
});