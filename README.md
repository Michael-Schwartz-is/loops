# Loops

Write JavaScript for your Webflow site from your local editor. Changes appear on the staging site in under a second. No deploy steps, no copy-pasting, no waiting.

## The Problem

If you've tried adding custom JavaScript to a Webflow site, you know the pain. You write code in a cramped embed box with no syntax highlighting, hit publish, wait for the site to deploy, open the staging URL, open the browser console, squint at the output, go back to Webflow, edit the embed, publish again. Every change is a multi-minute round trip through a UI that was never designed for code.

And if you're working with an AI coding agent? Forget it. The agent can't see the browser. It can't read console output. It can't check if the animation actually fired or if the selector even matched anything. It writes code blind, you paste it into Webflow blind, and you both hope for the best.

Loops exists because that workflow is broken. The idea is simple: your code lives in local `.js` files, a watcher syncs them to the cloud on every save, and the Webflow site picks up changes instantly. But the part that makes it actually useful — especially with AI — is closing the feedback loop. The agent writes code, the browser reloads, and Chrome DevTools MCP pipes the results (console logs, screenshots, DOM queries) straight back to the agent. No human in the middle copying and pasting. The agent can see what it built, verify it works, and fix it — all in one tight loop.

## What It Does

- **Edit locally.** Write real `.js` files in your editor with full syntax highlighting, autocomplete, and version control.
- **Instant sync.** A file watcher pushes every save to the cloud. Your Webflow staging site reloads automatically.
- **AI-native feedback.** Chrome DevTools MCP lets AI agents read console output, take screenshots, and query the DOM — closing the loop without you switching windows.
- **One script tag.** A single loader tag in Webflow handles everything: dev mode with live reload, production mode with published scripts. No per-script tags.

## How It Works

```
Your editor                    Cloud (Convex)                 Webflow staging site
───────────                    ──────────────                 ────────────────────
Edit homepage.js
    │
    └──► loops start ──push──► Store in file storage
                               Bump version ──────────────►  Loader detects change
                                                              Page reloads
                                                              Script runs
                                                                  │
Chrome DevTools MCP ◄──────────────────────────────────────── Console output
```

You add `?loops` to your staging URL to activate dev mode. Without it, only published scripts load — so production visitors never see work-in-progress code.

## Quick Start

```bash
# Install
npm install -g loops-cli

# Create account
loops signup

# Create a project (creates a directory with scripts/ folder)
loops init my-site

# The init command prints a <script> tag.
# Paste it in Webflow → Site Settings → Custom Code → Before </body>
# Then publish your staging site.

# Add a script
cd my-site
loops add homepage

# Start the watcher (syncs on every save)
loops start

# Edit scripts/homepage.js in your editor.
# Open your staging site with ?loops in the URL.
# Changes appear in ~1 second.
```

## Script Naming = Page Scoping

The script filename determines which pages it loads on:

| File | Loads on |
|------|----------|
| `scripts/homepage.js` | `/` (homepage) |
| `scripts/about.js` | `/about` |
| `scripts/pricing.js` | `/pricing` |
| `scripts/global-nav.js` | Every page |
| `scripts/global-analytics.js` | Every page |

Any script prefixed with `global-` runs on all pages. Everything else matches the page slug.

## Publishing

Dev mode (`?loops`) loads your latest saved code. When you're ready for production visitors:

```bash
loops publish homepage     # Now loads without ?loops
loops unpublish homepage   # Pull it back
```

## AI Workflow

Loops is designed to work with AI coding agents. The included [agent skill](skills/loops-webflow/SKILL.md) teaches the agent the full workflow:

1. Start the watcher
2. Inspect the page with Chrome DevTools MCP (`take_screenshot`, `evaluate_script`)
3. Write the script using real class names from the live DOM
4. Save → auto-push → auto-reload
5. Verify with `list_console_messages` and `take_screenshot`
6. Iterate until it works, then `loops publish`

To set up Chrome DevTools MCP:
```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect
```

## Commands

| Command | |
|---------|---|
| `loops signup` | Create account |
| `loops login` | Log in |
| `loops logout` | Log out |
| `loops forgot-password` | Reset password via email |
| `loops init <site>` | Create project, get loader tag |
| `loops add <script>` | Create a script file |
| `loops remove <script>` | Delete script locally and remotely |
| `loops start` | Watch all projects, sync on save |
| `loops status` | Show projects and script versions |
| `loops publish <script>` | Ship to production |
| `loops unpublish <script>` | Remove from production |

## Architecture

The backend runs on [Convex](https://convex.dev) — database, file storage, and HTTP endpoints in one service. No infrastructure to manage.

```
packages/
  cli/       CLI tool (TypeScript, Commander.js, Chokidar)
  convex/    Backend (Convex functions, HTTP actions, file storage)
  shared/    Shared types
```

The CLI pushes script files to Convex file storage via actions. The Webflow loader is served as an HTTP action that fetches and injects scripts into the page. In dev mode, a ConvexClient WebSocket subscription watches for version changes and triggers page reloads.

## License

MIT
