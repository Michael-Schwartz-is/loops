import fs from "node:fs/promises";
import path from "node:path";
import { saveConfig, DEFAULT_API_URL } from "../config.js";

export async function initCommand(
  projectName: string,
  opts: { apiUrl?: string }
) {
  const apiUrl = opts.apiUrl || DEFAULT_API_URL;
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

## Workflow
1. Add a script: \`loops add ${projectName} <script-name>\`
2. Paste the script tag it gives you into Webflow (page-level or site-level)
3. Run \`loops start\` — keeps scripts synced and pulls logs while you work
4. Edit files in ./scripts/ — changes sync to the live site automatically

## Key files
- \`scripts/*.js\` — your code, each file is served to Webflow
- \`page-context.html\` — the live DOM from your Webflow site (auto-updated by \`loops start\`). READ THIS to find class names and element structure before writing code.
- \`logs.json\` — browser console output and errors from your site
- \`.loops.json\` — project config (do not edit)

## Scripts in this project
(none yet — use \`loops add\` to create scripts)

## Rules for writing Webflow scripts
- Scripts load before \`</body>\` so the DOM is ready. Do NOT wrap code in DOMContentLoaded.
- The HTML and CSS are built in Webflow. NEVER generate HTML with JavaScript.
- Read \`page-context.html\` to find the real class names (\`.hero-section_home\`, \`.nav_link\`, etc).
- Code adds BEHAVIOR: animations, interactions, form logic, API calls.
- Use GSAP/ScrollTrigger for animations (loaded via Webflow).
- Work with the existing DOM — query it, animate it, enhance it. Don't replace it.
- Always verify selectors exist before operating on them. Log if not found.
- Webflow uses IX2 (Interactions 2) for animations — it sets inline styles (height, opacity, display). Check inline styles, not classes, to detect open/closed state.
`;

  await fs.writeFile(path.join(projectDir, "LOOPS.md"), guide);
  await fs.writeFile(path.join(projectDir, "logs.json"), "[]\n");

  console.log(`\nProject "${projectName}" created with ID ${projectId}.\n`);
  console.log(`To connect it to your Webflow site:`);
  console.log(`  1. Go to Webflow → Site Settings → Custom Code → Before </body>`);
  console.log(`  2. Paste this script tag:\n`);
  console.log(`     ${baseTag}\n`);
  console.log(`Next step: Read ${projectName}/LOOPS.md, then run: loops add ${projectName} <script-name>\n`);
}
