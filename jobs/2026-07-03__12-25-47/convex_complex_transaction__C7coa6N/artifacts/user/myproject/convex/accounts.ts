import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createAccount = mutation({
  args: {
    name: v.string(),
    initialBalance: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) {
      throw new Error(`Account with name ${args.name} already exists`);
    }
    await ctx.db.insert("accounts", {
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
      throw new Error("Transfer amount must be positive");
    }

    const fromAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.fromName))
      .first();
    const toAccount = await ctx.db
      .query("accounts")
      .withIndex("by_name", (q) => q.eq("name", args.toName))
      .first();

    if (!fromAccount) {
      throw new Error(`From account ${args.fromName} not found`);
    }
    if (!toAccount) {
      throw new Error(`To account ${args.toName} not found`);
    }
    if (fromAccount.balance < args.amount) {
      throw new Error("Insufficient balance");
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
      .first();
    if (!account) {
      throw new Error(`Account ${args.name} not found`);
    }
    return account.balance;
  },
});
