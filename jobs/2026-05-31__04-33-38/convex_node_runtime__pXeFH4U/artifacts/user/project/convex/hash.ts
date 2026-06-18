"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

export const generate = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    return crypto.createHash('sha256').update(args.text).digest('hex');
  },
});
