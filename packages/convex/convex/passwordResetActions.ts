"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { hashKey, hashPassword } from "./auth";
import { Resend } from "resend";

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(internal.users.getUserByEmail, { email });
    if (!user) return; // Don't reveal if email exists

    // Rate limit: max 3 resets per hour
    const recentResets = await ctx.runQuery(
      internal.passwordReset.getRecentResets,
      { email, since: Date.now() - 60 * 60 * 1000 }
    );
    if (recentResets >= 3)
      throw new Error("Too many reset attempts. Try again later.");

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = hashKey(code);

    await ctx.runMutation(internal.passwordReset.insertReset, {
      email,
      codeHash,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      createdAt: Date.now(),
    });

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Loops <onboarding@resend.dev>",
      to: email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    });
  },
});

export const completePasswordReset = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }) => {
    const reset = await ctx.runQuery(internal.passwordReset.getLatestReset, {
      email,
    });
    if (!reset) throw new Error("No reset requested");
    if (reset.expiresAt < Date.now()) throw new Error("Code expired");
    if (reset.attempts >= 5)
      throw new Error("Too many attempts. Request a new code.");

    // Increment attempts
    await ctx.runMutation(internal.passwordReset.incrementAttempts, {
      resetId: reset._id,
    });

    const codeHash = hashKey(code);
    if (codeHash !== reset.codeHash) throw new Error("Invalid code");

    // Update password
    const user = await ctx.runQuery(internal.users.getUserByEmail, { email });
    if (!user) throw new Error("User not found");

    const passwordHash = hashPassword(newPassword);
    await ctx.runMutation(internal.passwordReset.updatePassword, {
      userId: user._id,
      passwordHash,
    });
  },
});
