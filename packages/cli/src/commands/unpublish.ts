import { Command } from "commander";
import { readConfig, findProjectDir } from "../config.js";
import { getCredentialsOrThrow } from "../credentials.js";
import { getConvexClient } from "../convex.js";
import { api } from "@loops/convex/convex/_generated/api";

export const unpublishCommand = new Command("unpublish")
  .argument("<script-name>", "Script to unpublish")
  .description("Remove a script from published (stops serving without ?loops)")
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
      await client.mutation(api.scripts.unpublishScript, {
        privateKey: creds.privateKey,
        projectId: config.projectId,
        scriptName,
      });

      console.log(
        `Unpublished ${scriptName}. It will only load with ?loops now.`
      );
    } catch (err: any) {
      console.error(`Unpublish failed: ${err.message}`);
      process.exit(1);
    }
  });
