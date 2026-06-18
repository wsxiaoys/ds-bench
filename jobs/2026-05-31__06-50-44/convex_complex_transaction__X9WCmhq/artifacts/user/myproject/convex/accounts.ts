import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createAccount = mutation({
  args: {
    name: v.string(),
    initialBalance: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", {
      name: args.name,
      balance: args.initialBalance,
    });
  },
});

export const transfer = mutation({
  args: {
    fromName: v.string(),
    toName: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) {
      throw new Error("Transfer amount must be greater than zero");
    }

    const fromAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.fromName))
      .unique();
    const toAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.toName))
      .unique();

    if (!fromAccount) {
      throw new Error(`Account not found: ${args.fromName}`);
    }
    if (!toAccount) {
      throw new Error(`Account not found: ${args.toName}`);
    }
    if (fromAccount.balance < args.amount) {
      throw new Error("Insufficient funds");
    }

    await ctx.db.patch(fromAccount._id, {
      balance: fromAccount.balance - args.amount,
    });
    await ctx.db.patch(toAccount._id, {
      balance: toAccount.balance + args.amount,
    });
  },
});

export const getBalance = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (!account) {
      throw new Error(`Account not found: ${args.name}`);
    }

    return account.balance;
  },
});
