import fs from "node:fs/promises";
import path from "node:path";
import { findProjects, loadConfig } from "../config.js";
import type { ProjectConfig } from "@loops/shared";

export async function statusCommand(opts: { remote?: boolean }) {
  const cwd = process.cwd();
  const projects = await findProjects(cwd);

  // Also check if cwd itself is a project
  const cwdConfig = await loadConfig(cwd);
  if (cwdConfig) {
    projects.push({ dir: cwd, config: cwdConfig });
  }

  if (projects.length === 0) {
    console.log("No Loops projects found.");
    return;
  }

  console.log(`\n${projects.length} project(s)\n`);

  for (const { dir, config } of projects) {
    console.log(`  ${config.name} (${config.projectId})`);
    console.log(`    API: ${config.apiUrl}`);
    if (config.scripts.length > 0) {
      console.log(`    Local scripts: ${config.scripts.join(", ")}`);
    } else {
      console.log(`    Local scripts: (none)`);
    }

    if (opts.remote) {
      await showRemoteStatus(dir, config);
    }

    console.log("");
  }
}

async function showRemoteStatus(dir: string, config: ProjectConfig) {
  try {
    const res = await fetch(
      `${config.apiUrl}/debug/${config.projectId}`,
      { headers: { Authorization: `Bearer ${config.authToken}` } }
    );

    if (!res.ok) {
      console.log(`    Remote: failed to fetch (${res.status})`);
      return;
    }

    const data = await res.json() as {
      meta: { version: number; scripts: string[]; updatedAt: string } | null;
      r2Version: number | null;
      scripts: { name: string; size: number; preview: string }[];
    };

    if (!data.meta) {
      console.log("    Remote: project not found on server");
      return;
    }

    console.log(`    Server version: ${data.meta.version} (R2: ${data.r2Version ?? "n/a"})`);
    console.log(`    Last updated: ${data.meta.updatedAt}`);

    if (data.scripts.length === 0) {
      console.log("    Server scripts: (none)");
    } else {
      for (const s of data.scripts) {
        // Compare with local file
        const localPath = path.join(dir, "scripts", `${s.name}.js`);
        let localSize = "missing";
        try {
          const stat = await fs.stat(localPath);
          localSize = `${stat.size}b`;
        } catch {
          // File doesn't exist locally
        }

        console.log(`    ${s.name}: ${s.size}b on server, ${localSize} local`);
        console.log(`      preview: ${s.preview.replace(/\n/g, "\\n").slice(0, 80)}`);
      }
    }

    // Check for scripts in local config but not on server
    const serverNames = data.scripts.map((s) => s.name);
    const missing = config.scripts.filter((s) => !serverNames.includes(s));
    if (missing.length > 0) {
      console.log(`    Not on server: ${missing.join(", ")}`);
    }
  } catch (err: any) {
    console.log(`    Remote: ${err.message}`);
  }
}
