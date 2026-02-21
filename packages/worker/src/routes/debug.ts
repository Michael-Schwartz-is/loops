import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { ProjectMeta } from "@loops/shared";
import { authMiddleware } from "../middleware/auth.js";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/debug/:projectId", authMiddleware, async (c) => {
  const projectId = c.req.param("projectId");

  // Read meta from KV
  const raw = await c.env.META.get(`meta:${projectId}`);
  const meta: ProjectMeta | null = raw ? JSON.parse(raw) : null;

  // Read R2 version (strongly consistent)
  const vObj = await c.env.SCRIPTS.get(`${projectId}/_v`);
  const r2Version = vObj ? parseInt(await vObj.text(), 10) : null;

  // List scripts in R2
  const listed = await c.env.SCRIPTS.list({ prefix: `${projectId}/` });
  const scripts: { name: string; size: number; preview: string }[] = [];

  for (const obj of listed.objects) {
    // Skip the version marker
    if (obj.key === `${projectId}/_v`) continue;

    const name = obj.key.replace(`${projectId}/`, "").replace(/\.js$/, "");
    const full = await c.env.SCRIPTS.get(obj.key);
    const text = full ? await full.text() : "";

    scripts.push({
      name,
      size: obj.size,
      preview: text.slice(0, 120),
    });
  }

  return c.json({
    meta,
    r2Version,
    scripts,
  });
});

export default app;
