import { Command } from "commander";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { readConfig, findProjectDir } from "../config.js";

export const addCommand = new Command("add")
  .argument("<script-name>", "Script name (e.g. homepage, global-nav)")
  .description("Add a new script to the current project")
  .action(async (scriptName: string) => {
    const projectDir = findProjectDir(process.cwd());
    if (!projectDir) {
      console.error(
        "No .loops.json found. Run this from inside a project directory."
      );
      process.exit(1);
    }

    // Validate script name
    if (!/^[a-zA-Z0-9-]+$/.test(scriptName)) {
      console.error(
        "Script name must be alphanumeric with hyphens only (e.g. homepage, global-nav)"
      );
      process.exit(1);
    }

    const config = readConfig(projectDir);
    const scriptPath = join(projectDir, "scripts", `${scriptName}.js`);

    if (existsSync(scriptPath)) {
      console.error(`Script ${scriptName}.js already exists`);
      process.exit(1);
    }

    // Create script file with template
    const template = `// ${scriptName}.js — ${config.projectId}
// This script ${scriptName.startsWith("global-") ? "loads on every page" : `loads on the "${scriptName}" page`}

console.log("${scriptName} script loaded");
`;

    writeFileSync(scriptPath, template);

    // Update LOOPS.md
    updateLoopsMd(projectDir, scriptName);

    console.log(`Created scripts/${scriptName}.js`);
    console.log(`Start \`loops start\` to sync changes automatically.`);
  });

function updateLoopsMd(projectDir: string, scriptName: string): void {
  const loopsMdPath = join(projectDir, "LOOPS.md");
  if (!existsSync(loopsMdPath)) return;

  let content = readFileSync(loopsMdPath, "utf-8");
  const scope = scriptName.startsWith("global-")
    ? "all pages"
    : `"${scriptName}" page`;
  const entry = `- \`scripts/${scriptName}.js\` — ${scope}\n`;

  if (!content.includes(entry)) {
    content += entry;
    writeFileSync(loopsMdPath, content);
  }
}
