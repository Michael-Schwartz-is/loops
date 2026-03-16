import { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getConvexClient } from "../convex.js";
import { getCredentialsOrThrow } from "../credentials.js";
import { writeConfig } from "../config.js";
import { api } from "@loops/convex/convex/_generated/api";

const CONVEX_SITE_URL = "https://greedy-flamingo-603.convex.site";

export const initCommand = new Command("init")
  .argument("<site-name>", "Webflow site name (e.g. acme-corp)")
  .description("Create a new Loops project")
  .action(async (siteName: string) => {
    const creds = getCredentialsOrThrow();
    const projectDir = join(process.cwd(), siteName);

    if (existsSync(projectDir)) {
      console.error(`Directory ${siteName}/ already exists`);
      process.exit(1);
    }

    try {
      const client = getConvexClient();
      const result = await client.mutation(api.projects.createProject, {
        privateKey: creds.privateKey,
        projectId: siteName,
      });

      // Create local directory structure
      mkdirSync(join(projectDir, "scripts"), { recursive: true });

      writeConfig(projectDir, {
        projectId: siteName,
        publicKey: result.publicKey,
      });

      // Generate LOOPS.md
      const loopsmd = generateLoopsMd(siteName);
      writeFileSync(join(projectDir, "LOOPS.md"), loopsmd);

      const loaderTag = `<script src="${CONVEX_SITE_URL}/loader/${result.publicKey}/${siteName}"></script>`;

      console.log(`\nProject "${siteName}" created!`);
      console.log(
        `\nPaste this in Webflow → Site Settings → Custom Code → Before </body>:\n`
      );
      console.log(`  ${loaderTag}`);
      console.log(`\nThen publish your staging site.`);
    } catch (err: any) {
      console.error("Init failed:", err.message);
      process.exit(1);
    }
  });

function generateLoopsMd(siteName: string): string {
  return `# ${siteName} — Loops Project

## How This Works

You edit JavaScript files in \`scripts/\`. A file watcher (\`loops start\`) pushes changes to the cloud instantly. The Webflow staging site reloads automatically.

## Feedback Loop

Use Chrome DevTools MCP to see results:
- \`list_console_messages\` — read script console output
- \`take_screenshot\` — visually verify changes
- \`evaluate_script\` — test selectors in the live page
- \`list_network_requests\` — debug API calls

After saving a file, the page reloads automatically (<1 second). Then check results with the tools above.

## Webflow Coding Rules

- **NEVER generate HTML with JavaScript.** The HTML/CSS is built in Webflow.
- Select elements by their Webflow class names (\`.hero-section_home\`, \`.nav_link\`).
- Your code adds **behavior**: animations, interactions, form logic, API calls.
- Use GSAP/ScrollTrigger for animations (load from CDN if needed).
- Work with the existing DOM — query it, animate it, enhance it. Don't replace it.
- Always verify selectors exist before operating on them. Log if not found.

## Writing Useful Logs

Add \`console.log()\` at key steps — specific, actionable messages:
- \`console.log("Selected .card elements:", cards.length, "found")\`
- \`console.log("Animation applied to", els.length, "elements, 0.15s stagger")\`

## Scripts

(auto-updated by \`loops add\` / \`loops remove\`)
`;
}
