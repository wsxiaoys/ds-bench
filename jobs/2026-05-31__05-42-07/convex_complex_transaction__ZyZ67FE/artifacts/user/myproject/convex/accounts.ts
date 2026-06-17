import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createAccount = mutation({
  args: { name: v.string(), initialBalance: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      throw new Error("Account already exists");
    }
    await ctx.db.insert("accounts", {
      name: args.name,
      balance: args.initialBalance,
    });
  },
});

export const getBalance = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!account) {
      throw new Error("Account not found");
    }
    return account.balance;
  },
});

export const transfer = mutation({
  args: { fromName: v.string(), toName: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const fromAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.fromName))
      .first();
    if (!fromAccount) {
      throw new Error("Source account not found");
    }

    if (fromAccount.balance < args.amount) {
      throw new Error("Insufficient funds");
    }

    const toAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.toName))
      .first();
    if (!toAccount) {
      throw new Error("Destination account not found");
    }

    await ctx.db.patch(fromAccount._id, {
      balance: fromAccount.balance - args.amount,
    });
    
    await ctx.db.patch(toAccount._id, {
      balance: toAccount.balance + args.amount,
    });
  },
});
