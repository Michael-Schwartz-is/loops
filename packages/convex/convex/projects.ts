import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveUserByPrivateKey } from "./auth";

export const createProject = mutation({
  args: {
    privateKey: v.string(),
    projectId: v.string(),
  },
  handler: async (ctx, { privateKey, projectId }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    // Check if project already exists for this user
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_projectId", (q) =>
        q.eq("ownerPublicKey", user.publicKey).eq("projectId", projectId)
      )
      .unique();
    if (existing) throw new Error("Project already exists");

    await ctx.db.insert("projects", {
      projectId,
      ownerPublicKey: user.publicKey,
      createdAt: Date.now(),
    });

    return { projectId, publicKey: user.publicKey };
  },
});

export const listProjects = query({
  args: { privateKey: v.string() },
  handler: async (ctx, { privateKey }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    return await ctx.db
      .query("projects")
      .withIndex("by_ownerPublicKey", (q) =>
        q.eq("ownerPublicKey", user.publicKey)
      )
      .collect();
  },
});
