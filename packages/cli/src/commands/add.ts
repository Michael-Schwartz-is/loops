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
  const code = `// ${scriptName} — ${config.name}\nconsole.log("[Loops] ${scriptName} loaded");\n`;
  await fs.writeFile(scriptPath, code);

  // Push to worker immediately so the script tag works right away
  const pushRes = await fetch(
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

  if (!pushRes.ok) {
    const body = await pushRes.text();
    console.error(`Warning: failed to push script to worker: ${pushRes.status} ${body}`);
  }

  // Update config
  config.scripts.push(scriptName);
  await saveConfig(projectDir, config);

  // Update LOOPS.md script list
  await updateLoopsMd(projectDir, config.scripts, config.name);

  const scriptTag = `<script src="${config.apiUrl}/s/${config.projectId}/${scriptName}"></script>`;

  console.log(`\nAdded script "${scriptName}" to ${projectName}.\n`);
  console.log(`Paste this in Webflow on the relevant page → Custom Code → Before </body>:\n`);
  console.log(`  ${scriptTag}\n`);
  console.log(`Next step: Run \`loops start\` to begin syncing.`);
  console.log(`Then read ${projectName}/page-context.html for the live DOM class names before writing code.\n`);
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
