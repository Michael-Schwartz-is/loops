import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config.js";

export async function clearLogsCommand(project: string) {
  const projectDir = path.resolve(project);
  const config = await loadConfig(projectDir);

  if (!config) {
    console.error(`No Loops project found in "${project}".`);
    process.exit(1);
  }

  // Clear remote logs
  const res = await fetch(`${config.apiUrl}/logs/${config.projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.authToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to clear remote logs: ${res.status} ${body}`);
    process.exit(1);
  }

  // Clear local logs.json
  const logsPath = path.join(projectDir, "logs.json");
  await fs.writeFile(logsPath, "[]\n");

  console.log(`Cleared logs for "${config.name}".`);
}
