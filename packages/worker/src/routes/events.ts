import { Hono } from "hono";
import type { Bindings } from "../types.js";

const app = new Hono<{ Bindings: Bindings }>();

// Read version from R2 (strongly consistent) instead of KV (eventually consistent)
async function getR2Version(scripts: R2Bucket, projectId: string): Promise<number> {
  const obj = await scripts.get(`${projectId}/_v`);
  if (!obj) return 0;
  return parseInt(await obj.text(), 10) || 0;
}

app.get("/events/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const initialVersion = await getR2Version(c.env.SCRIPTS, projectId);

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

        const currentVersion = await getR2Version(c.env.SCRIPTS, projectId);

        if (currentVersion > initialVersion) {
          await write(
            `event: reload\ndata: ${JSON.stringify({ version: currentVersion })}\n\n`
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
