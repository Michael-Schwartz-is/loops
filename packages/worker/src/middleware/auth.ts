import { Context, Next } from "hono";
import type { Bindings } from "../types.js";

export async function authMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization" }, 401);
  }

  const token = auth.slice(7);
  const projectId = c.req.param("projectId");

  const storedToken = await c.env.META.get(`token:${projectId}`);
  if (!storedToken || storedToken !== token) {
    return c.json({ error: "Invalid token" }, 403);
  }

  await next();
}
