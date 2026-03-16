import { sha256 } from "@noble/hashes/sha2.js";
import { scrypt } from "@noble/hashes/scrypt.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { QueryCtx } from "./_generated/server";

// Use scrypt for password hashing (slow, brute-force resistant)
export function hashPassword(password: string): string {
  const salt = "loops-v2-salt";
  return bytesToHex(
    scrypt(new TextEncoder().encode(password), new TextEncoder().encode(salt), {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })
  );
}

// Use SHA-256 for API key hashing (keys have high entropy, speed is fine)
export function hashKey(key: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(key)));
}

export async function resolveUserByPrivateKey(
  ctx: { db: QueryCtx["db"] },
  privateKey: string
): Promise<{ _id: any; email: string; publicKey: string } | null> {
  const keyHash = hashKey(privateKey);
  const user = await ctx.db
    .query("users")
    .withIndex("by_privateKeyHash", (q) => q.eq("privateKeyHash", keyHash))
    .unique();
  return user;
}

export async function verifyProjectOwner(
  ctx: { db: QueryCtx["db"] },
  privateKey: string,
  projectId: string
): Promise<{ user: any; project: any }> {
  const user = await resolveUserByPrivateKey(ctx, privateKey);
  if (!user) throw new Error("Invalid credentials");

  const project = await ctx.db
    .query("projects")
    .withIndex("by_owner_and_projectId", (q) =>
      q.eq("ownerPublicKey", user.publicKey).eq("projectId", projectId)
    )
    .unique();
  if (!project) throw new Error("Project not found");

  return { user, project };
}

export function generateKey(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${bytesToHex(bytes)}`;
}
