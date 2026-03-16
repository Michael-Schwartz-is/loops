import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    publicKey: v.string(),
    privateKeyHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_publicKey", ["publicKey"])
    .index("by_privateKeyHash", ["privateKeyHash"]),

  projects: defineTable({
    projectId: v.string(),
    ownerPublicKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner_and_projectId", ["ownerPublicKey", "projectId"])
    .index("by_ownerPublicKey", ["ownerPublicKey"]),

  scripts: defineTable({
    projectId: v.string(),
    ownerPublicKey: v.string(),
    scriptName: v.string(),
    wipStorageId: v.id("_storage"),
    wipVersion: v.number(),
    publishedStorageId: v.union(v.id("_storage"), v.null()),
    publishedVersion: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  })
    .index("by_project", ["ownerPublicKey", "projectId"])
    .index("by_project_and_name", ["ownerPublicKey", "projectId", "scriptName"]),

  passwordResets: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
});
