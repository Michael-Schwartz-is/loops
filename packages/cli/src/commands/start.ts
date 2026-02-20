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

  console.log(`\nWatching ${projects.length} project(s)\n`);

  for (const { dir, config } of projects) {
    const scriptCount = config.scripts.length;
    console.log(
      `  ${config.name}: ${scriptCount} script(s)`
    );

    startWatcher(dir, config);
    startPoller(dir, config, interval);
  }

  console.log("");

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

  let pushing = false;

  const pushFile = async (filePath: string) => {
    if (pushing) return;
    pushing = true;

    try {
      const scriptName = path.basename(filePath, ".js");
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
        console.log(
          `[${time}] ${config.name}/${scriptName} → v${version} (${code.length}b)`
        );
      }
    } catch (err: any) {
      console.error(`  Push error: ${err.message}`);
    } finally {
      pushing = false;
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

      // Read existing, append, write
      let existing: LogEntry[] = [];
      try {
        const raw = await fs.readFile(logsPath, "utf-8");
        existing = JSON.parse(raw);
      } catch {
        existing = [];
      }

      const merged = [...existing, ...newEntries].slice(-1000);
      await fs.writeFile(logsPath, JSON.stringify(merged, null, 2) + "\n");

      // Extract latest page HTML context to a separate file
      const pageHtmlEntries = newEntries.filter((e) => e.type === "page-html");
      if (pageHtmlEntries.length > 0) {
        const latest = pageHtmlEntries[pageHtmlEntries.length - 1];
        const html = Array.isArray(latest.args) ? latest.args[0] : "";
        if (typeof html === "string" && html.length > 0) {
          const contextPath = path.join(projectDir, "page-context.html");
          await fs.writeFile(contextPath, html);
        }
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
          `[${time}] ${config.name}: +${newEntries.length} logs (${errors.length} error(s))`
        );
      } else {
        console.log(`[${time}] ${config.name}: +${newEntries.length} logs`);
      }
    } catch {
      // Network error, will retry
    }
  };

  poll();
  setInterval(poll, intervalMs);
}
