# Loops — Plan & Progress

## What is Loops

A free tool that lets Webflow developers use AI agents (Claude Code, Codex, etc.) to write live custom code for their sites. The AI edits scripts locally, they sync to the cloud (Cloudflare R2), run on the Webflow staging site, and browser logs flow back so the AI can self-correct.

**The user just says:** "add staggered fade-ins to hero-section_home"
**The AI handles everything:** writes JS, pushes it, reads logs, iterates.

## Architecture

```
AI Agent (local)  ←→  Loops API (Cloudflare Worker)  ←→  Webflow Page (browser)
   edits scripts        R2: stores & serves scripts         runs scripts
   reads logs.json      D1: stores logs                     sends logs (staging only)
                        KV: project metadata                auto-reloads (staging only)
                        SSE: reload signals
```

## Key Design Decisions

- **Per-page embeds**: each script gets its own `<script src>` tag, placed wherever needed in Webflow
- **One base tag**: pasted in Site Settings (global), serves utilities (logging, HMR). Only activates on `.webflow.io` domains — dormant on production
- **IIFE wrapping**: every script is wrapped in `(function(){ ... })()` to prevent scope leaks
- **Scripts are just scripts**: no scope/page mapping in config. The AI tells the user where to paste each tag
- **Logs never cleared**: capped at 1000 per project, include `scriptVersion` + `timestamp` so AI can differentiate
- **Log batching**: browser buffers logs, flushes every 2s via `sendBeacon` (survives page reloads)
- **SSE long-poll for HMR**: browser connects via EventSource, Worker polls KV for version change every 1s, sends reload event. Full page reload.
- **Free forever**: R2 has zero egress, D1/KV/Workers all on free tier. Production hosting costs $0
- **Self-host/export option**: `loops export` dumps standalone JS files, but no reason to since hosting is free

## User Experience Flow

```
User: "Set up Loops for Acme Corp, I need a script for the homepage"

AI:   → loops init acme-corp
      → loops add acme-corp homepage

      Paste these in Webflow:
      1. Site Settings → Before </body>:  <script src="https://loops.dev/s/k7x9m2"></script>
      2. Homepage → Before </body>:       <script src="https://loops.dev/s/k7x9m2/homepage"></script>
      Publish staging and let me know.

User: "done"
AI:   → pushes test log, sees it come back
      Connected! What do you want to build?

User: "add staggered fade-ins to hero-section_home"
AI:   → edits scripts/homepage.js, daemon pushes to R2, page reloads
      → reads logs.json: "Fade-in initialized on 4 elements"
      Done.
```

## Local File Structure

```
~/loops/
├── acme-corp/
│   ├── .loops.json        ← project config (projectId, authToken, scripts list)
│   ├── LOOPS.md           ← Webflow coding guide + script inventory (AI reads this)
│   ├── scripts/
│   │   ├── homepage.js
│   │   ├── contact-form.js
│   │   └── global-nav.js
│   └── logs.json             ← browser logs (AI reads this)
├── client-b/
│   └── ...
```

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `POST /projects` | POST | — | Create project → returns projectId + token + base tag |
| `GET /s/:projectId` | GET | — | Serve base utilities (logging, HMR, .webflow.io check) |
| `GET /s/:projectId/:script` | GET | — | Serve IIFE-wrapped script code from R2 |
| `PUT /code/:projectId/:script` | PUT | Bearer | Push script code to R2, bump version |
| `DELETE /code/:projectId/:script` | DELETE | Bearer | Remove script from R2 |
| `POST /logs/:projectId` | POST | — | Receive log batch from browser → D1 |
| `GET /logs/:projectId?since=` | GET | Bearer | Fetch logs from D1 with cursor |
| `GET /events/:projectId` | GET | — | SSE long-poll for hot reload |

## CLI Commands

```bash
loops init <project-name>           # Create project, prints base tag
loops add <project> <script-name>   # Add script, prints script tag
loops remove <project> <script>     # Remove script
loops start                         # Watch all projects, sync scripts + poll logs
loops status                        # Show projects + scripts
loops export <project>              # Export standalone JS files
loops export <project> --inline     # Output code ready to paste in Webflow
```

## Webflow Coding Rules (from LOOPS.md)

- The HTML and CSS are built in Webflow. NEVER generate HTML with JavaScript.
- Select elements by their Webflow class names (`.hero-section_home`, `.nav_link`).
- Code adds BEHAVIOR: animations, interactions, form logic, API calls.
- Use GSAP/ScrollTrigger for animations.
- Work with the existing DOM — query it, animate it, enhance it. Don't replace it.
- Always verify selectors exist before operating on them. Log if not found.

## Tech Stack

- **Worker**: Cloudflare Workers + Hono + R2 (scripts) + D1 (logs) + KV (metadata)
- **CLI**: TypeScript + Commander + Chokidar (will compile to standalone binary via `bun compile`)
- **Monorepo**: npm workspaces — `packages/worker`, `packages/cli`, `packages/shared`

## Log Format

```json
{
  "type": "log | warn | error | unhandled-error | unhandled-rejection | network-error",
  "args": ["Fade-in initialized on 4 elements"],
  "message": "optional error message",
  "stack": "optional stack trace",
  "timestamp": "2026-02-17T14:32:01.123Z",
  "scriptVersion": 3,
  "script": "homepage"
}
```

---

## Progress

### DONE — Steps 1-6 (all core functionality built + tested locally)

- [x] **Step 1: Scaffold** — monorepo with `packages/worker`, `packages/cli`, `packages/shared`. Shared types: `LogEntry`, `ProjectConfig`, `ProjectMeta`.
- [x] **Step 2: Core API** — `POST /projects`, `PUT /code`, `GET /s/:projectId/:script` (IIFE-wrapped), auth middleware (Bearer token checked against KV).
- [x] **Step 3: Base utilities / Loader** — Console override (log/warn/error/info/debug), `window.onerror`, `unhandledrejection`, fetch intercept, XHR intercept. Log batching via `sendBeacon` (2s flush). SSE connection + full page reload. `.webflow.io` domain check (dormant on production). Served at `GET /s/:projectId`.
- [x] **Step 4: Logs** — `POST /logs/:projectId` (batch insert into D1, trim to 1000). `GET /logs/:projectId?since=` (cursor-based query from D1).
- [x] **Step 5: SSE** — `GET /events/:projectId` (TransformStream, polls KV every 1s for 25s, sends `event: reload` on version change, EventSource auto-reconnects).
- [x] **Step 6: CLI** — `init` (creates project via API, writes .loops.json + LOOPS.md + logs.json + scripts/), `add` (creates script file, updates config + LOOPS.md, prints tag), `remove`, `start` (multi-project file watcher via chokidar + log poller), `status`, `export` (standalone files or --inline for Webflow paste).

### Verified end-to-end locally:
1. `POST /projects` → got projectId + token + base tag
2. `PUT /code/:id/homepage` → stored in R2, version bumped
3. `GET /s/:id/homepage` → received IIFE-wrapped code
4. `POST /logs/:id` → logs inserted into D1
5. `GET /logs/:id` → logs returned with auth
6. Auth rejection → 401 without token
7. CLI `init` → created project folder with all files
8. CLI `add` → created script file, printed tag
9. CLI `status` → showed project inventory

### TODO — Remaining steps

- [ ] **Step 7: Deploy to Cloudflare** — `wrangler login`, create R2 bucket + D1 database + KV namespace, update wrangler.toml IDs, apply D1 schema remotely, `wrangler deploy`.
- [ ] **Step 8: Test with real Webflow site** — paste embeds in a staging .webflow.io site, verify full loop (push code → page reloads → logs appear in logs.json).
- [ ] **Step 9: Binary distribution** — `bun compile` the CLI into standalone binary, create install.sh script.
- [ ] **Step 10: Polish** — error handling improvements, retry logic in daemon, graceful shutdown, CORS fine-tuning.

## Key Files

| File | Purpose |
|---|---|
| `packages/worker/src/index.ts` | Hono app entry, route registration |
| `packages/worker/src/loader.ts` | Generates the loader JS (logging, HMR, domain check) |
| `packages/worker/src/routes/projects.ts` | POST /projects — create project |
| `packages/worker/src/routes/script.ts` | GET /s/ — serve loader + scripts |
| `packages/worker/src/routes/code.ts` | PUT/DELETE /code/ — push/remove scripts |
| `packages/worker/src/routes/logs.ts` | POST/GET /logs/ — receive + serve logs |
| `packages/worker/src/routes/events.ts` | GET /events/ — SSE reload stream |
| `packages/worker/src/middleware/auth.ts` | Bearer token validation |
| `packages/worker/schema.sql` | D1 table schema for logs |
| `packages/worker/wrangler.toml` | Cloudflare config (R2, D1, KV bindings) |
| `packages/cli/src/index.ts` | CLI entry (commander) |
| `packages/cli/src/commands/init.ts` | loops init |
| `packages/cli/src/commands/add.ts` | loops add |
| `packages/cli/src/commands/start.ts` | loops start (watcher + poller) |
| `packages/cli/src/commands/status.ts` | loops status |
| `packages/cli/src/commands/exportCmd.ts` | loops export |
| `packages/cli/src/commands/remove.ts` | loops remove |
| `packages/cli/src/config.ts` | .loops.json read/write/discover |
| `packages/shared/src/index.ts` | Shared types |
