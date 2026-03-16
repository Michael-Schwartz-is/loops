import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { resolveUserByPrivateKey } from "./auth";

export const publishScript = mutation({
  args: {
    privateKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
  },
  handler: async (ctx, { privateKey, projectId, scriptName }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    const script = await ctx.db
      .query("scripts")
      .withIndex("by_project_and_name", (q) =>
        q
          .eq("ownerPublicKey", user.publicKey)
          .eq("projectId", projectId)
          .eq("scriptName", scriptName)
      )
      .unique();
    if (!script) throw new Error("Script not found");

    await ctx.db.patch(script._id, {
      publishedStorageId: script.wipStorageId,
      publishedVersion: script.wipVersion,
      updatedAt: Date.now(),
    });
  },
});

export const unpublishScript = mutation({
  args: {
    privateKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
  },
  handler: async (ctx, { privateKey, projectId, scriptName }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    const script = await ctx.db
      .query("scripts")
      .withIndex("by_project_and_name", (q) =>
        q
          .eq("ownerPublicKey", user.publicKey)
          .eq("projectId", projectId)
          .eq("scriptName", scriptName)
      )
      .unique();
    if (!script) throw new Error("Script not found");

    // Delete the published file from storage if it differs from wip
    if (
      script.publishedStorageId &&
      script.publishedStorageId !== script.wipStorageId
    ) {
      await ctx.storage.delete(script.publishedStorageId);
    }

    await ctx.db.patch(script._id, {
      publishedStorageId: null,
      publishedVersion: null,
      updatedAt: Date.now(),
    });
  },
});

export const removeScript = mutation({
  args: {
    privateKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
  },
  handler: async (ctx, { privateKey, projectId, scriptName }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    const script = await ctx.db
      .query("scripts")
      .withIndex("by_project_and_name", (q) =>
        q
          .eq("ownerPublicKey", user.publicKey)
          .eq("projectId", projectId)
          .eq("scriptName", scriptName)
      )
      .unique();
    if (!script) throw new Error("Script not found");

    // Delete files from storage
    await ctx.storage.delete(script.wipStorageId);
    if (
      script.publishedStorageId &&
      script.publishedStorageId !== script.wipStorageId
    ) {
      await ctx.storage.delete(script.publishedStorageId);
    }

    await ctx.db.delete(script._id);
  },
});

// Queries (no auth needed — used by loader)
export const getProjectVersion = query({
  args: { publicKey: v.string(), projectId: v.string() },
  handler: async (ctx, { publicKey, projectId }) => {
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) =>
        q.eq("ownerPublicKey", publicKey).eq("projectId", projectId)
      )
      .collect();

    if (scripts.length === 0) return 0;
    return Math.max(...scripts.map((s) => s.updatedAt));
  },
});

export const getPublishedScripts = query({
  args: { publicKey: v.string(), projectId: v.string() },
  handler: async (ctx, { publicKey, projectId }) => {
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) =>
        q.eq("ownerPublicKey", publicKey).eq("projectId", projectId)
      )
      .collect();

    return scripts
      .filter((s) => s.publishedStorageId !== null)
      .map((s) => ({
        scriptName: s.scriptName,
        version: s.publishedVersion,
      }));
  },
});

export const getWipScripts = query({
  args: { publicKey: v.string(), projectId: v.string() },
  handler: async (ctx, { publicKey, projectId }) => {
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) =>
        q.eq("ownerPublicKey", publicKey).eq("projectId", projectId)
      )
      .collect();

    return scripts.map((s) => ({
      scriptName: s.scriptName,
      version: s.wipVersion,
    }));
  },
});

export const listScripts = query({
  args: { privateKey: v.string(), projectId: v.string() },
  handler: async (ctx, { privateKey, projectId }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) throw new Error("Invalid credentials");

    return await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) =>
        q.eq("ownerPublicKey", user.publicKey).eq("projectId", projectId)
      )
      .collect();
  },
});

export const getScriptStorageId = query({
  args: {
    publicKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
    mode: v.string(),
  },
  handler: async (ctx, { publicKey, projectId, scriptName, mode }) => {
    const script = await ctx.db
      .query("scripts")
      .withIndex("by_project_and_name", (q) =>
        q
          .eq("ownerPublicKey", publicKey)
          .eq("projectId", projectId)
          .eq("scriptName", scriptName)
      )
      .unique();

    if (!script) return null;
    return mode === "wip" ? script.wipStorageId : script.publishedStorageId;
  },
});

// Internal helpers
export const upsertScript = internalMutation({
  args: {
    ownerPublicKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
    wipStorageId: v.id("_storage"),
  },
  handler: async (
    ctx,
    { ownerPublicKey, projectId, scriptName, wipStorageId }
  ) => {
    const existing = await ctx.db
      .query("scripts")
      .withIndex("by_project_and_name", (q) =>
        q
          .eq("ownerPublicKey", ownerPublicKey)
          .eq("projectId", projectId)
          .eq("scriptName", scriptName)
      )
      .unique();

    if (existing) {
      // Delete old WIP file from storage
      if (existing.wipStorageId !== wipStorageId) {
        await ctx.storage.delete(existing.wipStorageId);
      }
      await ctx.db.patch(existing._id, {
        wipStorageId,
        wipVersion: existing.wipVersion + 1,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("scripts", {
        projectId,
        ownerPublicKey,
        scriptName,
        wipStorageId,
        wipVersion: 1,
        publishedStorageId: null,
        publishedVersion: null,
        updatedAt: Date.now(),
      });
    }
  },
});

export const verifyOwnership = internalQuery({
  args: { privateKey: v.string(), projectId: v.string() },
  handler: async (ctx, { privateKey, projectId }) => {
    const user = await resolveUserByPrivateKey(ctx, privateKey);
    if (!user) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_projectId", (q) =>
        q.eq("ownerPublicKey", user.publicKey).eq("projectId", projectId)
      )
      .unique();
    if (!project) return null;

    return { publicKey: user.publicKey };
  },
});
