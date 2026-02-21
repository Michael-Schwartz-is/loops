import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { ProjectMeta } from "@loops/shared";

const app = new Hono<{ Bindings: Bindings }>();

app.post("/projects", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name) {
    return c.json({ error: "Missing project name" }, 400);
  }

  const projectId = crypto.randomUUID().slice(0, 8);
  const authToken = crypto.randomUUID();

  const meta: ProjectMeta = {
    name,
    version: 0,
    scripts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    c.env.META.put(`meta:${projectId}`, JSON.stringify(meta)),
    c.env.META.put(`token:${projectId}`, authToken),
  ]);

  const apiBase = new URL(c.req.url).origin;

  return c.json({
    projectId,
    authToken,
    baseTag: `<script src="${apiBase}/s/${projectId}"></script>`,
  });
});

export default app;
