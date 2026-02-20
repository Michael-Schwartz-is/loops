import { findProjects, loadConfig } from "../config.js";

export async function statusCommand() {
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

  for (const { config } of projects) {
    console.log(`  ${config.name} (${config.projectId})`);
    console.log(`    API: ${config.apiUrl}`);
    if (config.scripts.length > 0) {
      console.log(`    Scripts: ${config.scripts.join(", ")}`);
    } else {
      console.log(`    Scripts: (none)`);
    }
    console.log("");
  }
}
