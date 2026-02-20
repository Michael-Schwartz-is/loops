import { Hono } from "hono";
import type { Bindings } from "../types.js";
import type { LogEntry } from "@loops/shared";
import { authMiddleware } from "../middleware/auth.js";

const app = new Hono<{ Bindings: Bindings }>();

// Receive logs from browser
app.post("/logs/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const entries: LogEntry[] = JSON.parse(await c.req.text());

  if (!Array.isArray(entries) || entries.length === 0) {
    return c.json({ ok: true, count: 0 });
  }

  const stmt = c.env.DB.prepare(
    "INSERT INTO logs (project_id, type, args, message, stack, url, timestamp, script_version, script, page, user_agent, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const batch = entries.map((e) =>
    stmt.bind(
      projectId,
      e.type,
      JSON.stringify(e.args),
      e.message ?? null,
      e.stack ?? null,
      e.url ?? null,
      e.timestamp,
      e.scriptVersion ?? 0,
      e.script ?? null,
      e.page ?? null,
      e.userAgent ?? null,
      e.sessionId ?? null
    )
  );

  await c.env.DB.batch(batch);

  // Trim to 1000 rows per project
  await c.env.DB.prepare(
    "DELETE FROM logs WHERE project_id = ? AND id NOT IN (SELECT id FROM logs WHERE project_id = ? ORDER BY id DESC LIMIT 1000)"
  )
    .bind(projectId, projectId)
    .run();

  return c.json({ ok: true, count: entries.length });
});

// Fetch logs (for daemon/AI)
// By default, returns only logs from the latest script version + one tab.
// This deduplicates when multiple people have the staging site open.
// Pass ?all_sessions=true to get logs from all tabs/versions.
app.get("/logs/:projectId", authMiddleware, async (c) => {
  const projectId = c.req.param("projectId");
  const since = c.req.query("since");
  const allSessions = c.req.query("all_sessions") === "true";

  // Find the latest version and pick one tab for dedup
  let dedup = "";
  let dedupBinds: (string | number)[] = [];
  if (!allSessions) {
    // Get the latest script version
    const latest = await c.env.DB.prepare(
      "SELECT script_version, session_id FROM logs WHERE project_id = ? AND session_id IS NOT NULL ORDER BY id DESC LIMIT 1"
    )
      .bind(projectId)
      .first<{ script_version: number; session_id: string }>();

    if (latest) {
      // Filter to that version + the tab that reported most recently
      dedup = " AND script_version = ? AND session_id = ?";
      dedupBinds = [latest.script_version, latest.session_id];
    }
  }

  let result;
  if (since) {
    result = await c.env.DB.prepare(
      `SELECT * FROM logs WHERE project_id = ? AND timestamp > ?${dedup} ORDER BY id ASC LIMIT 200`
    )
      .bind(projectId, since, ...dedupBinds)
      .all();
  } else {
    result = await c.env.DB.prepare(
      `SELECT * FROM logs WHERE project_id = ?${dedup} ORDER BY id DESC LIMIT 200`
    )
      .bind(projectId, ...dedupBinds)
      .all();
    result.results.reverse();
  }

  const logs: LogEntry[] = result.results.map((row: any) => ({
    type: row.type,
    args: JSON.parse(row.args),
    message: row.message,
    stack: row.stack,
    url: row.url,
    timestamp: row.timestamp,
    scriptVersion: row.script_version,
    script: row.script,
    page: row.page,
    userAgent: row.user_agent,
    sessionId: row.session_id,
  }));

  return c.json(logs);
});

// Delete all logs for a project
app.delete("/logs/:projectId", authMiddleware, async (c) => {
  const projectId = c.req.param("projectId");

  await c.env.DB.prepare("DELETE FROM logs WHERE project_id = ?")
    .bind(projectId)
    .run();

  return c.json({ ok: true });
});

export default app;
