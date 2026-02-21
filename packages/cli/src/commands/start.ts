import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { watch } from "chokidar";
import type { ProjectConfig, LogEntry } from "@loops/shared";
import { findProjects } from "../config.js";

export async function startCommand(opts: { pollInterval?: string }) {
  const interval = parseInt(opts.pollInterval || "3000", 10);
  const cwd = process.cwd();
  const projects = await findProjects(cwd);

  if (projects.length === 0) {
    // Check if current dir itself is a project
    const { loadConfig } = await import("../config.js");
    const config = await loadConfig(cwd);
    if (config) {
      projects.push({ dir: cwd, config });
    } else {
      console.error(
        "No Loops projects found. Run `loops init <name>` first."
      );
      process.exit(1);
    }
  }

  console.log(`\nWatching ${projects.length} project(s)...\n`);

  for (const { dir, config } of projects) {
    const scriptCount = config.scripts.length;
    console.log(
      `  ${config.name}: ${scriptCount} script(s) — syncing to ${config.apiUrl}`
    );

    startWatcher(dir, config);
    startPoller(dir, config, interval);
  }

  console.log(`\nScripts sync on save. Logs and page-context.html update automatically.`);
  console.log(`Read page-context.html to see the live DOM before writing code.\n`);

  process.on("SIGINT", () => {
    console.log("\nLoops stopped.");
    process.exit(0);
  });
}

function startWatcher(projectDir: string, config: ProjectConfig) {
  const scriptsDir = path.join(projectDir, "scripts");

  const watcher = watch(path.join(scriptsDir, "*.js"), {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const pushing = new Map<string, boolean>();
  const pending = new Map<string, string>();

  const pushFile = async (filePath: string) => {
    const scriptName = path.basename(filePath, ".js");

    if (pushing.get(scriptName)) {
      // A push is in flight — mark this file as needing another push
      pending.set(scriptName, filePath);
      return;
    }

    pushing.set(scriptName, true);

    try {
      const code = await fs.readFile(filePath, "utf-8");

      const res = await fetch(
        `${config.apiUrl}/code/${config.projectId}/${scriptName}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain",
            Authorization: `Bearer ${config.authToken}`,
          },
          body: code,
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`  Push failed (${scriptName}): ${res.status} ${body}`);
      } else {
        const { version } = await res.json();
        const time = new Date().toLocaleTimeString();
        const hash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 8);
        console.log(
          `[${time}] Synced ${config.name}/${scriptName} → v${version} (${code.length}b, ${hash})`
        );
      }
    } catch (err: any) {
      console.error(`  Push error: ${err.message}`);
    } finally {
      pushing.set(scriptName, false);

      // If another change came in while we were pushing, push again
      const pendingPath = pending.get(scriptName);
      if (pendingPath) {
        pending.delete(scriptName);
        pushFile(pendingPath);
      }
    }
  };

  watcher.on("add", pushFile);
  watcher.on("change", pushFile);
}

function startPoller(
  projectDir: string,
  config: ProjectConfig,
  intervalMs: number
) {
  const logsPath = path.join(projectDir, "logs.json");
  let lastTimestamp: string | null = null;

  const poll = async () => {
    try {
      const url = new URL(`${config.apiUrl}/logs/${config.projectId}`);
      if (lastTimestamp) {
        url.searchParams.set("since", lastTimestamp);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${config.authToken}` },
      });

      if (!res.ok) return;

      const newEntries: LogEntry[] = await res.json();
      if (newEntries.length === 0) return;

      // Extract page HTML to its own file (not stored in logs)
      const pageHtmlEntries = newEntries.filter((e) => e.type === "page-html");
      if (pageHtmlEntries.length > 0) {
        const latest = pageHtmlEntries[pageHtmlEntries.length - 1];
        const html = Array.isArray(latest.args) ? latest.args[0] : "";
        if (typeof html === "string" && html.length > 0) {
          const contextPath = path.join(projectDir, "page-context.html");
          await fs.writeFile(contextPath, html);
        }
      }

      // Store only non-HTML log entries
      const logEntries = newEntries.filter((e) => e.type !== "page-html");
      if (logEntries.length > 0) {
        let existing: LogEntry[] = [];
        try {
          const raw = await fs.readFile(logsPath, "utf-8");
          existing = JSON.parse(raw);
        } catch {
          existing = [];
        }

        const merged = [...existing, ...logEntries].slice(-1000);
        await fs.writeFile(logsPath, JSON.stringify(merged, null, 2) + "\n");
      }

      lastTimestamp = newEntries[newEntries.length - 1].timestamp;

      const errors = newEntries.filter(
        (e) =>
          e.type === "error" ||
          e.type === "unhandled-error" ||
          e.type === "unhandled-rejection"
      );

      const time = new Date().toLocaleTimeString();
      if (errors.length > 0) {
        console.log(
          `[${time}] ${config.name}: +${logEntries.length} logs (${errors.length} error(s)) — read logs.json to see details and fix.`
        );
      } else if (logEntries.length > 0) {
        console.log(`[${time}] ${config.name}: +${logEntries.length} logs`);
      }
    } catch {
      // Network error, will retry
    }
  };

  poll();
  setInterval(poll, intervalMs);
}
