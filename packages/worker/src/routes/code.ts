import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { ProjectMeta } from "@loops/shared";
import { authMiddleware } from "../middleware/auth.js";

const app = new Hono<{ Bindings: Bindings }>();

// Push script code
app.put("/code/:projectId/:script", authMiddleware, async (c) => {
  const projectId = c.req.param("projectId");
  const script = c.req.param("script");
  const code = await c.req.text();

  // Store script in R2
  await c.env.SCRIPTS.put(`${projectId}/${script}.js`, code);

  // Bump project version
  const raw = await c.env.META.get(`meta:${projectId}`);
  const meta: ProjectMeta = raw
    ? JSON.parse(raw)
    : { name: "", version: 0, createdAt: new Date().toISOString(), updatedAt: "" };

  meta.version++;
  meta.updatedAt = new Date().toISOString();

  await c.env.META.put(`meta:${projectId}`, JSON.stringify(meta));

  return c.json({ ok: true, version: meta.version, script });
});

// Delete a script
app.delete("/code/:projectId/:script", authMiddleware, async (c) => {
  const projectId = c.req.param("projectId");
  const script = c.req.param("script");

  await c.env.SCRIPTS.delete(`${projectId}/${script}.js`);

  return c.json({ ok: true, deleted: script });
});

export default app;
