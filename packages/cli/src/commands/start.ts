import { Command } from "commander";
import { watch } from "chokidar";
import { readFileSync } from "fs";
import { join, relative, dirname, basename } from "path";
import { findProjects, readConfig } from "../config.js";
import { getCredentialsOrThrow } from "../credentials.js";
import { getConvexClient } from "../convex.js";
import { api } from "@loops/convex/convex/_generated/api";

export const startCommand = new Command("start")
  .description("Watch all projects and sync scripts to Convex on save")
  .action(async () => {
    const creds = getCredentialsOrThrow();
    const baseDir = process.cwd();
    const projects = findProjects(baseDir);

    if (projects.length === 0) {
      console.error("No projects found. Run: loops init <site-name>");
      process.exit(1);
    }

    console.log(`Watching ${projects.length} project(s):`);
    projects.forEach((p) => console.log(`  ${relative(baseDir, p)}/`));

    const client = getConvexClient();

    // Watch all scripts directories
    const watchPaths = projects.map((p) => join(p, "scripts", "*.js"));

    const watcher = watch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },
    });

    async function pushFile(filePath: string, attempt = 1) {
      const scriptName = basename(filePath, ".js");
      const projectDir = dirname(dirname(filePath)); // scripts/ -> project/
      const config = readConfig(projectDir);

      try {
        const code = readFileSync(filePath, "utf-8");
        await client.action(api.scriptActions.pushScript, {
          privateKey: creds.privateKey,
          projectId: config.projectId,
          scriptName,
          code,
        });
        console.log(`✓ Pushed ${config.projectId}/${scriptName}.js`);
      } catch (err: any) {
        if (attempt < 3) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          setTimeout(() => pushFile(filePath, attempt + 1), delay);
        } else {
          console.error(`✗ Failed to push ${scriptName}: ${err.message}`);
        }
      }
    }

    watcher.on("change", (filePath: string) => {
      pushFile(filePath);
    });

    watcher.on("add", (filePath: string) => {
      pushFile(filePath);
    });

    console.log("\nWatching for changes... (Ctrl+C to stop)");

    process.on("SIGINT", () => {
      console.log("\nStopping...");
      watcher.close();
      process.exit(0);
    });
  });
