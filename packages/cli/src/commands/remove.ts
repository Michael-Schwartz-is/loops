import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig, saveConfig } from "../config.js";

export async function removeCommand(projectName: string, scriptName: string) {
  const projectDir = path.resolve(projectName);
  const config = await loadConfig(projectDir);

  if (!config) {
    console.error(
      `No .loops.json found in ${projectDir}. Run "loops init ${projectName}" first.`
    );
    process.exit(1);
  }

  if (!config.scripts.includes(scriptName)) {
    console.error(`Script "${scriptName}" not found in ${projectName}.`);
    process.exit(1);
  }

  // Delete from API
  try {
    await fetch(`${config.apiUrl}/code/${config.projectId}/${scriptName}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.authToken}` },
    });
  } catch {
    console.error("Warning: could not delete from API (may not be running).");
  }

  // Delete local file
  const scriptPath = path.join(projectDir, "scripts", `${scriptName}.js`);
  try {
    await fs.unlink(scriptPath);
  } catch {
    // File may not exist
  }

  // Update config
  config.scripts = config.scripts.filter((s) => s !== scriptName);
  await saveConfig(projectDir, config);

  console.log(`Removed script "${scriptName}" from ${projectName}.`);
}
