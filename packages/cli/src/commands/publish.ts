import { Command } from "commander";
import { readConfig, findProjectDir } from "../config.js";
import { getCredentialsOrThrow } from "../credentials.js";
import { getConvexClient } from "../convex.js";
import { api } from "@loops/convex/convex/_generated/api";

export const publishCommand = new Command("publish")
  .argument("<script-name>", "Script to publish")
  .description("Publish the current WIP version of a script")
  .action(async (scriptName: string) => {
    const projectDir = findProjectDir(process.cwd());
    if (!projectDir) {
      console.error("No .loops.json found.");
      process.exit(1);
    }

    const config = readConfig(projectDir);
    const creds = getCredentialsOrThrow();

    try {
      const client = getConvexClient();
      await client.mutation(api.scripts.publishScript, {
        privateKey: creds.privateKey,
        projectId: config.projectId,
        scriptName,
      });

      console.log(
        `Published ${scriptName}! It now loads for all visitors (without ?loops).`
      );
    } catch (err: any) {
      console.error(`Publish failed: ${err.message}`);
      process.exit(1);
    }
  });
