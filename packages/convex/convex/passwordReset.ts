import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getRecentResets = internalQuery({
  args: { email: v.string(), since: v.number() },
  handler: async (ctx, { email, since }) => {
    const resets = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    return resets.filter((r) => r.createdAt >= since).length;
  },
});

export const getLatestReset = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .first();
  },
});

export const insertReset = internalMutation({
  args: {
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("passwordResets", args);
  },
});

export const incrementAttempts = internalMutation({
  args: { resetId: v.id("passwordResets") },
  handler: async (ctx, { resetId }) => {
    const reset = await ctx.db.get(resetId);
    if (reset) {
      await ctx.db.patch(resetId, { attempts: reset.attempts + 1 });
    }
  },
});

export const updatePassword = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, { userId, passwordHash }) => {
    await ctx.db.patch(userId, { passwordHash });
  },
});
