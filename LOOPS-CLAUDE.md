# Loops — AI Agent Instructions

You are working with **Loops**, a live coding tool for Webflow. You edit JavaScript files locally, they sync to the cloud and run on the user's Webflow staging site. Browser logs flow back to a local `logs.json` so you can see output and debug.

## Setup (do this first)

The `loops` CLI is not on npm yet. It's installed locally via npm link from the source repo.

**Check if `loops` is available:**
```bash
which loops
```

**If not found**, link it from the source:
```bash
cd /Users/michael/Documents/code/CodeFlow && npm install && npm run build -w packages/cli && cd packages/cli && npm link
```

After linking, `loops` is available globally as a shell command.

## API URL

The Loops API is deployed at:
```
API_URL=https://loops.mike-a99.workers.dev
```

Pass this to every `loops init` command using the `--api-url` flag. Existing projects already have it stored in `.loops.json`.

## Workflow

### 1. Create a project
```bash
loops init my-project --api-url $API_URL
```
This creates a `my-project/` folder with `.loops.json`, `LOOPS.md`, `logs.json`, and a `scripts/` directory. It prints a **base tag** — tell the user to paste it in Webflow → Site Settings → Custom Code → Before </body>.

### 2. Add scripts
```bash
loops add my-project homepage
```
This creates `my-project/scripts/homepage.js` and prints a **script tag** — tell the user to paste it on the relevant page in Webflow → Page Settings → Before </body>.

After pasting tags, the user must **Publish to staging** (not production) for them to take effect.

### 3. Start the daemon
```bash
loops start
```
Run this from the parent directory that contains your project folder(s). It:
- **Watches** `scripts/*.js` — any file save is pushed to the cloud instantly
- **Polls logs** every 3s — new browser logs are appended to `logs.json`
- **Triggers hot reload** — the staging site reloads automatically (~1-2s)

Keep this running in a background terminal. It discovers all projects in subdirectories automatically.

### 4. Write code
Edit the `.js` files in `scripts/`. The daemon picks up saves and pushes them. The Webflow staging page reloads automatically.

### 5. Read logs
Check **only the most recent logs** in `logs.json`. Do NOT read the entire file — only read the last 40–60 lines to see recent output:
```bash
tail -80 my-project/logs.json
```
Each entry has a `type` (`log`, `warn`, `error`, `unhandled-error`, `unhandled-rejection`, `network-error`), `args` (the logged values), `timestamp`, `script` (which script produced it), and `scriptVersion`.

**After editing a script**, wait a few seconds, then read the tail of `logs.json` to verify it worked or see errors. This is your feedback loop — write code, read logs, iterate. Never read the full `logs.json` — it can have up to 1000 entries.

### 6. Iterate
If logs show errors, fix the script and save. The daemon pushes the update, the page reloads, new logs appear. Repeat until it works.

### 7. Clear logs when done
Once the user approves the result (animation works, feature is complete, etc.), clear the logs:
```bash
loops clear-logs my-project
```
This deletes all logs both remotely and locally. Start fresh for the next task.

## Page Context

The file `page-context.html` in the project directory contains the cleaned HTML of the currently loaded Webflow staging page. It is updated automatically whenever the page loads. **Read this file before writing any selectors or DOM queries** — it shows you all available class names, IDs, data attributes, and the element hierarchy. Scripts, styles, and SVGs are stripped; structure and selectors are preserved.

## Webflow Coding Rules

Read the project's `LOOPS.md` before writing any code. Key rules:

- **NEVER generate HTML with JavaScript.** The HTML/CSS is built in Webflow.
- Select elements by their Webflow class names (`.hero-section_home`, `.nav_link`).
- Your code adds **behavior**: animations, interactions, form logic, API calls.
- Use GSAP/ScrollTrigger for animations (load them from CDN if needed).
- Work with the existing DOM — query it, animate it, enhance it. Don't replace it.
- Always verify selectors exist before operating on them. Log if not found.

## Writing Useful Logs

Add `console.log()` calls at **key steps** in your scripts — not generic messages, but **actionable, specific logs** that describe what actually happened. One log per important step. Examples:

- `console.log("Selected .card elements:", cards.length, "of", expected, "found")`
- `console.log("ScrollTrigger registered for .hero-section, start:", trigger.start)`
- `console.log("Animation timeline created: 3 steps, total duration:", tl.duration() + "s")`
- `console.log("Form submit handler attached to", form.getAttribute("data-form-id"))`
- `console.log("Fetch /api/products returned", data.length, "items")`

**Bad (too generic):** `console.log("script loaded")`, `console.log("done")`
**Good (actionable):** `console.log("Stagger animation applied to 8 .feature-card elements, 0.15s delay")`

These logs are your only visibility into what runs on the Webflow site. Make each one count — it should tell you what happened, to which elements, and with what result.

## Commands Reference

```bash
loops init <project-name> --api-url <url>   # Create project, get base tag
loops add <project> <script-name>            # Add script, get script tag
loops remove <project> <script>              # Remove script
loops start                                  # Watch + sync + poll logs
loops status                                 # Show all projects and scripts
loops clear-logs <project>                   # Delete all logs (remote + local)
loops export <project>                       # Export standalone JS files
```

## Important Notes

- Scripts only hot-reload on `.webflow.io` staging domains. Production domains serve scripts but skip logging/HMR.
- Logs are a rolling window — only the last 1000 entries are kept (oldest are automatically discarded). Use `loops clear-logs <project>` to wipe them manually when done.
- Each script is wrapped in an IIFE automatically — no need to worry about scope leaks.
- The `loops start` daemon must be running for file sync and log polling to work.
