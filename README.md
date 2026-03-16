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

## Getting Started

If you don't know what any of the commands below mean, that's fine. Install the [agent skill](skills/loops-webflow/SKILL.md) and your AI agent will handle all of this for you — the setup, the scripting, the debugging, everything. Just tell it what you want your Webflow site to do.

### Setup

```bash
npm install -g loops-cli
loops signup
loops init my-site
```

The `init` command prints a `<script>` tag. Paste it in Webflow → Site Settings → Custom Code → Before `</body>`, then publish your staging site. That's the only time you touch Webflow.

### Write Code

```bash
cd my-site
loops add homepage
loops start
```

Edit `scripts/homepage.js`. Save. It's live on your staging site in under a second.

### Ship It

```bash
loops publish homepage      # Production visitors see it
loops unpublish homepage    # Pull it back
```

### Script Naming = Page Scoping

The filename decides which pages the script loads on:

| File | Loads on |
|------|----------|
| `scripts/homepage.js` | `/` (homepage) |
| `scripts/about.js` | `/about` |
| `scripts/pricing.js` | `/pricing` |
| `scripts/global-nav.js` | Every page |
| `scripts/global-analytics.js` | Every page |

Prefix with `global-` to run on all pages. Everything else matches the page slug.

---

## Under the Hood

The rest of this README is for people who want to understand the internals or contribute. You don't need any of this to use Loops.

### AI Workflow

Loops ships with an [agent skill](skills/loops-webflow/SKILL.md) that teaches AI coding agents the full workflow. When installed, the agent knows how to:

1. Start the file watcher
2. Inspect the live page with Chrome DevTools MCP (`take_screenshot`, `evaluate_script`)
3. Write scripts using real class names from the live DOM
4. Save → auto-push → auto-reload → verify with `list_console_messages`
5. Iterate until it works, then `loops publish`

To set up Chrome DevTools MCP:
```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect
```

### All Commands

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

### Architecture

The backend runs on [Convex](https://convex.dev) — database, file storage, and HTTP endpoints in one service.

```
packages/
  cli/       CLI tool (TypeScript, Commander.js, Chokidar)
  convex/    Backend (Convex functions, HTTP actions, file storage)
  shared/    Shared types
```

The CLI pushes script files to Convex file storage via actions. The Webflow loader is served as an HTTP action that fetches and injects scripts into the page. In dev mode, a ConvexClient WebSocket subscription watches for version changes and triggers page reloads.

## License

MIT
