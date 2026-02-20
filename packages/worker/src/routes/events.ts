import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { ProjectMeta } from "@loops/shared";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/events/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const raw = await c.env.META.get(`meta:${projectId}`);
  const meta: ProjectMeta | null = raw ? JSON.parse(raw) : null;
  const initialVersion = meta?.version ?? 0;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const write = (data: string) => writer.write(encoder.encode(data));

  const pollLoop = async () => {
    try {
      await write(": connected\n\n");

      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1000));

        const current = await c.env.META.get(`meta:${projectId}`);
        const currentMeta: ProjectMeta | null = current
          ? JSON.parse(current)
          : null;

        if ((currentMeta?.version ?? 0) > initialVersion) {
          await write(
            `event: reload\ndata: ${JSON.stringify({ version: currentMeta?.version })}\n\n`
          );
          break;
        }
      }
    } catch {
      // Client disconnected
    } finally {
      try {
        await writer.close();
      } catch {
        // Already closed
      }
    }
  };

  c.executionCtx.waitUntil(pollLoop());

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

export default app;
