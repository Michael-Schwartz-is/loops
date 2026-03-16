import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const insertUser = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    publicKey: v.string(),
    privateKeyHash: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("users", args);
  },
});

export const updatePrivateKey = internalMutation({
  args: {
    userId: v.id("users"),
    privateKeyHash: v.string(),
  },
  handler: async (ctx, { userId, privateKeyHash }) => {
    await ctx.db.patch(userId, { privateKeyHash });
  },
});
