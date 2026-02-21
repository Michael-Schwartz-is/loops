import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { ProjectMeta } from "@loops/shared";
import { generateLoader } from "../loader.js";

const app = new Hono<{ Bindings: Bindings }>();

// Serve base utilities (logging, HMR)
app.get("/s/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const raw = await c.env.META.get(`meta:${projectId}`);

  if (!raw) {
    return c.text("// Loops: project not found", 404, {
      "Content-Type": "application/javascript",
    });
  }

  const meta: ProjectMeta = JSON.parse(raw);
  const apiBase = new URL(c.req.url).origin;
  const js = generateLoader(apiBase, projectId, meta.version, meta.scripts || []);

  return c.text(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  });
});

// Serve a script file (IIFE-wrapped)
app.get("/s/:projectId/:script", async (c) => {
  const projectId = c.req.param("projectId");
  const script = c.req.param("script");

  const obj = await c.env.SCRIPTS.get(`${projectId}/${script}.js`);
  if (!obj) {
    return c.text("// Loops: script not found", 404, {
      "Content-Type": "application/javascript",
    });
  }

  const code = await obj.text();

  const wrapped = `(function(){\n${code}\n})();`;

  return c.text(wrapped, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  });
});

export default app;
