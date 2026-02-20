import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, saveConfig } from "../config.js";

export async function addCommand(
  projectName: string,
  scriptName: string,
  opts: { apiUrl?: string }
) {
  const projectDir = path.resolve(projectName);
  const config = await loadConfig(projectDir);

  if (!config) {
    console.error(
      `No .loops.json found in ${projectDir}. Run "loops init ${projectName}" first.`
    );
    process.exit(1);
  }

  if (config.scripts.includes(scriptName)) {
    console.error(`Script "${scriptName}" already exists in ${projectName}.`);
    process.exit(1);
  }

  // Create the script file
  const scriptPath = path.join(projectDir, "scripts", `${scriptName}.js`);
  await fs.writeFile(
    scriptPath,
    `// ${scriptName} — ${config.name}\nconsole.log("[Loops] ${scriptName} loaded");\n`
  );

  // Update config
  config.scripts.push(scriptName);
  await saveConfig(projectDir, config);

  // Update LOOPS.md script list
  await updateLoopsMd(projectDir, config.scripts, config.name);

  const scriptTag = `<script src="${config.apiUrl}/s/${config.projectId}/${scriptName}"></script>`;

  console.log(`\nAdded script "${scriptName}" to ${projectName}\n`);
  console.log(`Paste this on the relevant page in Webflow → Before </body>:\n`);
  console.log(`  ${scriptTag}\n`);
}

async function updateLoopsMd(
  projectDir: string,
  scripts: string[],
  projectName: string
) {
  const mdPath = path.join(projectDir, "LOOPS.md");
  try {
    let content = await fs.readFile(mdPath, "utf-8");

    // Replace the scripts section
    const scriptsSection =
      scripts.length > 0
        ? scripts.map((s) => `- ${s}.js`).join("\n")
        : "(none yet)";

    content = content.replace(
      /## Scripts in this project\n[\s\S]*?(?=\n## )/,
      `## Scripts in this project\n${scriptsSection}\n\n`
    );

    await fs.writeFile(mdPath, content);
  } catch {
    // LOOPS.md doesn't exist, skip
  }
}
