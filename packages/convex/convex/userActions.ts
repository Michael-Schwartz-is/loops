"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { hashPassword, hashKey, generateKey } from "./auth";

export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const existing = await ctx.runQuery(internal.users.getUserByEmail, {
      email,
    });
    if (existing) throw new Error("Email already registered");

    const passwordHash = hashPassword(password);
    const publicKey = generateKey("pk");
    const privateKey = generateKey("sk");
    const privateKeyHash = hashKey(privateKey);

    await ctx.runMutation(internal.users.insertUser, {
      email,
      passwordHash,
      publicKey,
      privateKeyHash,
      createdAt: Date.now(),
    });

    return { publicKey, privateKey };
  },
});

export const loginUser = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const user = await ctx.runQuery(internal.users.getUserByEmail, { email });
    if (!user) throw new Error("Invalid email or password");

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash)
      throw new Error("Invalid email or password");

    // Regenerate private key on login
    const privateKey = generateKey("sk");
    const privateKeyHash = hashKey(privateKey);

    await ctx.runMutation(internal.users.updatePrivateKey, {
      userId: user._id,
      privateKeyHash,
    });

    return { publicKey: user.publicKey, privateKey };
  },
});
