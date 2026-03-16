"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const pushScript = action({
  args: {
    privateKey: v.string(),
    projectId: v.string(),
    scriptName: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { privateKey, projectId, scriptName, code }) => {
    // Verify ownership via internal query
    const result = await ctx.runQuery(internal.scripts.verifyOwnership, {
      privateKey,
      projectId,
    });
    if (!result) throw new Error("Invalid credentials or project not found");

    // Validate script name: alphanumeric + hyphens only
    if (!/^[a-zA-Z0-9-]+$/.test(scriptName)) {
      throw new Error("Script name must be alphanumeric with hyphens only");
    }

    const blob = new Blob([code], { type: "application/javascript" });
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.scripts.upsertScript, {
      ownerPublicKey: result.publicKey,
      projectId,
      scriptName,
      wipStorageId: storageId,
    });
  },
});
