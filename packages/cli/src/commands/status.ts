import { Command } from "commander";
import { relative } from "path";
import { findProjects, readConfig } from "../config.js";
import { getCredentialsOrThrow } from "../credentials.js";
import { getConvexClient } from "../convex.js";
import { api } from "@loops/convex/convex/_generated/api";

export const statusCommand = new Command("status")
  .description("Show projects and scripts")
  .action(async () => {
    const creds = getCredentialsOrThrow();
    const baseDir = process.cwd();
    const projects = findProjects(baseDir);

    if (projects.length === 0) {
      console.log("No projects found.");
      return;
    }

    const client = getConvexClient();

    for (const projectDir of projects) {
      const config = readConfig(projectDir);
      console.log(`\n${relative(baseDir, projectDir)}/`);
      console.log(`  Project: ${config.projectId}`);

      try {
        const scripts = await client.query(api.scripts.listScripts, {
          privateKey: creds.privateKey,
          projectId: config.projectId,
        });

        if (scripts.length === 0) {
          console.log("  No scripts");
        } else {
          for (const s of scripts) {
            const pubStatus = s.publishedVersion
              ? `published (v${s.publishedVersion})`
              : "not published";
            console.log(
              `  ${s.scriptName}.js — WIP v${s.wipVersion}, ${pubStatus}`
            );
          }
        }
      } catch (err: any) {
        console.error(`  Error: ${err.message}`);
      }
    }
  });
