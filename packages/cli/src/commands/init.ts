import fs from "node:fs/promises";
import path from "node:path";
import { saveConfig } from "../config.js";

const DEFAULT_API = "http://localhost:8787";

export async function initCommand(
  projectName: string,
  opts: { apiUrl?: string }
) {
  const apiUrl = opts.apiUrl || DEFAULT_API;
  const projectDir = path.resolve(projectName);

  // Create project directory
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(projectDir, "scripts"), { recursive: true });

  // Register with API
  const res = await fetch(`${apiUrl}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to create project: ${res.status} ${body}`);
    process.exit(1);
  }

  const { projectId, authToken, baseTag } = await res.json();

  // Save config
  await saveConfig(projectDir, {
    name: projectName,
    projectId,
    apiUrl,
    authToken,
    scripts: [],
  });

  // Create LOOPS.md
  const guide = `# Loops Project: ${projectName}

## How this works
- Scripts live in ./scripts/ — each file is served to your Webflow site
- Edit scripts here, they auto-sync to the live site when \`loops start\` is running
- Read logs.json to see browser output and errors
- To add a new script: \`loops add ${projectName} <name>\`

## Scripts in this project
(none yet — use \`loops add\` to create scripts)

## Webflow coding rules
- The HTML and CSS are built in Webflow. NEVER generate HTML with JavaScript.
- Select elements by their Webflow class names (\`.hero-section_home\`, \`.nav_link\`).
- Code adds BEHAVIOR: animations, interactions, form logic, API calls.
- Use GSAP/ScrollTrigger for animations.
- Work with the existing DOM — query it, animate it, enhance it. Don't replace it.
- Always verify selectors exist before operating on them. Log if not found.
`;

  await fs.writeFile(path.join(projectDir, "LOOPS.md"), guide);
  await fs.writeFile(path.join(projectDir, "logs.json"), "[]\n");

  console.log(`\nCreated project "${projectName}" (${projectId})\n`);
  console.log(`Paste this in Webflow → Site Settings → Custom Code → Before </body>:\n`);
  console.log(`  ${baseTag}\n`);
  console.log(`Now add scripts with: loops add ${projectName} <script-name>\n`);
}
