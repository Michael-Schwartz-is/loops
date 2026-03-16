# Loops v2 — Design Spec

## Overview

Loops v2 is a redesign of the Loops live-coding tool for Webflow. It replaces the current Cloudflare-based infrastructure (Worker + R2 + D1 + KV + SSE) with Convex as the sole backend, and replaces the log pipeline with Chrome DevTools MCP for feedback. The goal is to drastically simplify setup and developer experience while keeping the core value: AI agents write custom code for Webflow sites, see the results, and iterate.

## Target Users

1. **Primary:** Webflow designers/no-coders who use AI agents to add custom behavior — they want to say "add fade-ins to my hero" and have it just work
2. **Secondary:** Developers who use Webflow but want a proper development workflow

The priority is making the first 5 minutes dead simple for group 1.

## Key Design Decisions

### Single loader tag
Users paste one `<script>` tag in Webflow Site Settings. That's the only manual Webflow step, ever. No per-page script tags. The loader discovers and loads all scripts for the project automatically.

### `?loops` URL parameter activation
- `?loops` in the URL activates dev mode: loads WIP scripts, connects WebSocket for realtime reload
- Without `?loops`: loads only published scripts (or does nothing if none published)
- This replaces the `.webflow.io` domain detection from v1
- Makes Loops a development tool, not a production hosting service — clean upgrade path to a paid tier for production serving

### Filename-based page scoping
Scripts are scoped to pages by filename convention:
- `homepage.js` — loads only when the last path segment (slug) is exactly `homepage` (or `/` which aliases to `homepage`)
- `about.js` — loads only when the slug is exactly `about`
- `global-nav.js` — files prefixed with `global-` load on every page
- Matching rule: **exact slug match only**. The slug is the last segment of the URL path. `/about` matches `about.js`, `/team/about` matches `about.js`, but `/about-us` does NOT match `about.js`
- `/` is a special case: aliases to `homepage.js`
- Scripts with hyphens that are NOT `global-` are matched literally: `contact-form.js` matches only the slug `contact-form`
- Matching is case-insensitive

No manifest, no config, no folder structure. The AI names the file, the loader handles scoping.

### WIP vs Published versions
Each script has two states:
- **WIP** — the latest version being actively developed. Only loads with `?loops`
- **Published** — a frozen "good" version. Loads for everyone without `?loops`

`loops publish <script>` promotes the current WIP version to published (copies `wipStorageId` → `publishedStorageId`, sets `publishedVersion` to the current `wipVersion` number). `loops unpublish <script>` removes it from production (sets `publishedStorageId` and `publishedVersion` to null). No export step, no copy-pasting code.

### Chrome DevTools MCP replaces log pipeline
No more D1 log storage, `logs.json`, or log polling. The AI agent reads console output, takes screenshots, inspects the DOM, and checks network requests directly via Chrome DevTools MCP tools. The infrastructure for collecting and serving logs is eliminated entirely.

### Convex replaces Cloudflare
Convex provides everything in one platform:
- **Database** — script metadata, versions, user accounts
- **File storage** — JS script content
- **HTTP actions** — serve the loader and scripts via `<script src>` URLs
- **WebSocket subscriptions** — instant realtime reload when scripts change (replaces SSE polling)
- **Built-in auth support** — for the Phase 2 dashboard

Free tier is sufficient: 1M function calls/month, 1 GB file storage, 1 GB bandwidth.

### Deterministic auto-reload
The browser-side loader subscribes to a Convex query via WebSocket (`ConvexClient.onUpdate`). When a script version changes, the loader triggers a full page reload (`window.location.reload()`). This is simpler and safer than hot-swapping script elements, since scripts that modify the DOM leave side effects (event listeners, animations, mutations) that can't be cleaned up by removing the `<script>` tag. Full reload ensures a clean state every time.

## Architecture

```
AI Agent (local)
  ├── edits scripts/*.js
  ├── file watcher pushes to Convex on save (debounced, 300ms)
  │   authenticates via private key from ~/.loops/credentials
  │   resolves project from .loops.json in script's parent directory
  └── reads results via Chrome DevTools MCP
       (console, screenshots, DOM, network)

Convex Backend
  ├── DB: users, projects, script metadata + versions
  ├── File storage: JS script content
  ├── HTTP actions: serve loader + scripts
  └── WebSocket: push version changes to browser (instant)

Webflow Page (browser)
  ├── single loader tag (always present, served from Convex)
  ├── if ?loops → dev mode
  │   ├── dynamically loads ConvexClient from CDN (~30-40KB)
  │   ├── loads all WIP scripts for this project
  │   ├── auto-reloads on version change (full page reload, deterministic)
  │   └── console output visible to agent via DevTools MCP
  └── if no ?loops → production mode
      ├── loads only published scripts via simple fetch (if any)
      └── no WebSocket, no Convex client, minimal overhead (<1KB loader)
```

## Data Model (Convex)

### users table
```typescript
{
  email: string,
  passwordHash: string,       // hashed via @noble/hashes (pure JS, runs in Convex actions)
  publicKey: string,          // "pk_a8x2k9m3" — used in loader URLs, safe to expose
  privateKeyHash: string,     // hash of "sk_7f3x..." — never stored in plaintext
  createdAt: number,
}
```

Note: The raw private key (`sk_...`) is generated once during signup, returned to the CLI, and stored in `~/.loops/credentials`. Only the hash is stored in Convex. On auth verification, the incoming Bearer token is hashed and compared against `privateKeyHash`.

### projects table
```typescript
{
  projectId: string,        // matches Webflow subdomain: "acme-corp"
  ownerPublicKey: string,   // links to user
  createdAt: number,
}
```

### scripts table
```typescript
{
  projectId: string,                          // "acme-corp"
  scriptName: string,                         // "homepage"
  wipStorageId: Id<"_storage">,               // latest JS file in Convex file storage
  wipVersion: number,                         // bumped on every push
  publishedStorageId: Id<"_storage"> | null,  // frozen "good" version
  publishedVersion: number | null,            // which wipVersion was promoted
  updatedAt: number,                          // subscription trigger for reload detection
}
```

### passwordResets table
```typescript
{
  email: string,
  codeHash: string,          // hash of the 6-digit reset code
  expiresAt: number,         // created + 10 minutes
  attempts: number,          // max 5 attempts before code is invalidated
  createdAt: number,
}
```

## Auth Model

### Phase 1 (CLI-only)

**Signup/login use Convex actions** (not mutations) because password hashing requires `@noble/hashes`, a pure-JS library that runs in the Convex V8 isolate action runtime.

- `loops signup` — prompts email + password, calls `createUser` action which hashes password, generates key pair, returns public key + raw private key (only time it's shown). CLI stores private key in `~/.loops/credentials`
- `loops login` — prompts email + password, calls `loginUser` action which verifies password hash, returns public key + re-generates a new private key (old one is invalidated). CLI updates `~/.loops/credentials`
- `loops forgot-password` — prompts email, calls `requestPasswordReset` action which sends 6-digit code via Resend (free tier: 3,000 emails/month). Code expires in 10 minutes, max 5 attempts. Prompts for code + new password, calls `completePasswordReset` action
- `loops logout` — deletes `~/.loops/credentials`
- All CLI commands send `sk_...` as Bearer token. Convex actions hash it and compare against stored `privateKeyHash`
- Rate limiting: max 3 password reset emails per hour per email address
- No browser, no OAuth, no popups

### Phase 2 (Dashboard)
- Web UI with Google/GitHub OAuth via Convex Auth
- Users link OAuth to existing email account
- Manage projects, scripts, API keys, collaborators

### Access control
- **CLI writes** (push, publish, unpublish): authenticated by private key (`sk_...`), verified by hashing and comparing to stored `privateKeyHash`
- **Script serving** (loader URL): public key (`pk_...`) identifies whose scripts to serve. No secrets in URLs
- **Project isolation**: projects are scoped to user's public key. Two users can have a project named "acme-corp" without conflict

## Convex Functions

### Actions (Node.js runtime — needed for hashing and file operations)
| Function | Auth | Purpose |
|---|---|---|
| `createUser` | — | Hash password with @noble/hashes, generate key pair, store user |
| `loginUser` | — | Verify password hash, regenerate private key, return keys |
| `requestPasswordReset` | — | Generate code, store hash + expiry, send via Resend. Max 3/hr/email |
| `completePasswordReset` | — | Verify code (max 5 attempts, 10min expiry), hash new password, update |
| `pushScript` | Bearer sk_ | Upload JS file to Convex file storage, bump wipVersion, update updatedAt |

### Mutations
| Function | Auth | Purpose |
|---|---|---|
| `createProject` | Bearer sk_ | Create project tied to user |
| `publishScript` | Bearer sk_ | Copy wipStorageId → publishedStorageId, set publishedVersion = wipVersion |
| `unpublishScript` | Bearer sk_ | Set publishedStorageId and publishedVersion to null |
| `removeScript` | Bearer sk_ | Delete script record + delete both wipStorageId and publishedStorageId from file storage |

### Queries
| Function | Auth | Purpose |
|---|---|---|
| `listScripts` | Bearer sk_ | List scripts + versions for CLI status |
| `getProjectVersion` | — | Returns max(updatedAt) across all scripts in project — browser subscribes for reload detection |
| `getPublishedScripts` | — | Returns published script names + URLs for a project (production mode) |
| `getWipScripts` | — | Returns WIP script names + URLs for a project (dev mode) |

### HTTP Actions
| Route | Purpose |
|---|---|
| `GET /loader/:publicKey/:projectId` | Serves the loader JS. In production mode: minimal script (<1KB) that fetches published scripts. In dev mode (`?loops`): dynamically loads ConvexClient from CDN, then subscribes for changes |
| `GET /script/:publicKey/:projectId/:scriptName?mode=wip\|published` | Serves JS file content from Convex file storage with `Content-Type: application/javascript` and appropriate cache headers |

The loader tag format:
```html
<script src="https://<deployment>.convex.site/loader/pk_a8x2k9m3/acme-corp"></script>
```

Both `publicKey` and `projectId` are in the URL to identify exactly which user's project to serve. The public key alone is not enough since a user can have multiple projects.

## CLI Commands

```bash
# Auth
loops signup              # email + password → creates account, stores keys in ~/.loops/credentials
loops login               # email + password → retrieves keys, updates credentials
loops logout              # deletes ~/.loops/credentials
loops forgot-password     # email → reset code via Resend → new password

# Project management
loops init <site-name>    # creates project + local folder structure
                          # prints the single loader tag to paste in Webflow Site Settings

# Script management
loops add <script-name>   # creates scripts/<script-name>.js locally
loops remove <script>     # removes script locally + from Convex (including file storage)

# Development
loops start               # watches all projects in subdirectories
                          # pushes to Convex on file save (debounced 300ms)
                          # authenticates via ~/.loops/credentials
                          # resolves project per file via .loops.json
                          # retries on network failure (exponential backoff, max 3 retries)
                          # no log polling — DevTools MCP handles feedback

# Publishing
loops publish <script>    # promotes current WIP to published
loops unpublish <script>  # removes from published

# Utility
loops status              # shows projects, scripts, WIP/published versions
```

## Local File Structure

### Single project
```
~/loops/acme-corp/
  ├── .loops.json          # { projectId: "acme-corp", publicKey: "pk_a8x2k9m3" }
  ├── LOOPS.md             # AI agent instructions + script inventory
  └── scripts/
      ├── homepage.js
      ├── about.js
      └── global-nav.js
```

### Multi-project
```
~/loops/
  ├── acme-corp/
  │   ├── .loops.json
  │   ├── LOOPS.md
  │   └── scripts/
  │       ├── homepage.js
  │       └── global-nav.js
  ├── client-b/
  │   ├── .loops.json
  │   ├── LOOPS.md
  │   └── scripts/
  │       ├── pricing.js
  │       └── global-footer.js
```

`loops start` from `~/loops/` discovers all subdirectories with `.loops.json` and watches all of them simultaneously.

## The Loader Script

The single `<script>` tag served from Convex. This is the most critical piece.

### Loader tag format
```html
<script src="https://<deployment>.convex.site/loader/pk_a8x2k9m3/acme-corp"></script>
```

### Behavior
```
Page loads → loader executes
  │
  ├─ No ?loops → production mode
  │   ├─ Fetch published script list from /script/:pk/:project/:name?mode=published
  │   ├─ None published → exit (only cost: the initial loader fetch, <1KB)
  │   └─ Has published → fetch each, inject as IIFEs (page-scoped by filename)
  │
  └─ ?loops present → dev mode
      ├─ Dynamically load ConvexClient from CDN (e.g. unpkg.com/convex/browser)
      ├─ Fetch all WIP scripts via HTTP action
      ├─ Inject as IIFEs (page-scoped by filename)
      ├─ Subscribe to getProjectVersion query via WebSocket
      └─ On version change → full page reload (window.location.reload())
```

### Why full page reload (not hot-swap)
Scripts modify the DOM: they add event listeners, start animations, mutate elements. Removing a `<script>` tag does not undo these side effects. A full page reload guarantees a clean state. This is the same approach as v1 and is reliable.

### Script injection
- Each script is wrapped in `(function(){ ... })()` to prevent scope leaks
- Scripts are injected as inline `<script>` elements in the `<head>`

### Page scoping rules
The loader checks each script's name against the current URL slug (last segment of pathname):
- **Exact slug match:** `about.js` loads only when slug === `about`
- **Homepage alias:** `homepage.js` loads when pathname is `/` (root)
- **Global prefix:** `global-*.js` loads on every page
- **Hyphenated names:** `contact-form.js` matches only slug `contact-form`
- **Case-insensitive:** `About.js` matches slug `about`
- No "contains" matching — prevents false positives like `about.js` loading on `/about-us`

### Production mode performance
- Loader script in production mode is <1KB (no ConvexClient bundled)
- Published scripts are fetched via simple HTTP GET with cache headers
- If no scripts are published, the loader exits immediately after a single fetch to check

### Dev mode ConvexClient loading
- ConvexClient (~30-40KB) is loaded dynamically from CDN only when `?loops` is in the URL
- This keeps the production loader lightweight while giving dev mode full realtime capabilities
- The CDN-loaded ConvexClient is cached by the browser after first load

## Chrome DevTools MCP Integration

Not built by us — documented and recommended. The AI agent uses the existing Chrome DevTools MCP server for feedback.

### User setup (one-time)
```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect
```
Enable remote debugging: `chrome://inspect/#remote-debugging` (Chrome 144+, or `--remote-debugging-port` fallback for older Chrome).

### How the AI uses it
- `list_console_messages` — read script output (replaces `tail logs.json`)
- `take_screenshot` — visually verify animations, layout changes
- `evaluate_script` — test selectors in page context before writing scripts
- `list_network_requests` — debug API calls, CORS issues
- `take_snapshot` — inspect DOM state

### LOOPS.md guidance
The auto-generated LOOPS.md tells the AI:
- Use `list_console_messages` after file saves to check output
- Use `take_screenshot` after visual changes
- Use `evaluate_script` to test selectors before committing to a script
- After saving a file, the page reloads automatically via WebSocket subscription. Wait for the reload to complete before checking results (typically <1 second)

## Error Handling & Availability

### Convex downtime
- **Production loader:** If Convex HTTP actions are unreachable, published scripts won't load. For Phase 1 this is acceptable — Convex has 99.9% uptime SLA. For a future paid tier, scripts could be served via CDN with cache fallback
- **Dev mode:** If the WebSocket connection drops, ConvexClient automatically reconnects with exponential backoff. No user action needed
- **CLI push:** If Convex is unreachable during `loops start`, the watcher retries with exponential backoff (max 3 retries per save). If all retries fail, it logs an error to the terminal and continues watching for the next save

### File watcher behavior
- Debounces rapid saves (300ms) — only the last save triggers a push
- Authenticates using private key from `~/.loops/credentials`
- Resolves project by walking up from the changed file to find `.loops.json`
- If `.loops.json` is missing or credentials are invalid, logs an error and skips

### CORS
- Loader is loaded via `<script src>` — no CORS needed
- Published/WIP scripts are fetched via `<script>` injection or inline — no CORS needed
- ConvexClient WebSocket connection handles its own CORS
- If scripts themselves use `fetch()` to call external APIs, that's the script author's concern, not Loops'

## Complete User Experience

### First time ever
```
User: "I want to add custom code to my Webflow site acme-corp"

Agent: → runs loops signup (prompts email + password)
       → runs loops init acme-corp
       → tells user: "Paste this one tag in Webflow Site Settings and publish"

User: "done"

Agent: → runs loops start in background
       → runs loops add homepage
       → "Open acme-corp.webflow.io?loops in Chrome.
         Enable remote debugging at chrome://inspect/#remote-debugging
         if you haven't already."

User: "ok, add staggered fade-ins to the hero section"

Agent: → reads LOOPS.md
       → uses evaluate_script to find selectors on the page
       → writes scripts/homepage.js
       → watcher pushes to Convex → page reloads instantly
       → calls list_console_messages → "Fade-in applied to 4 elements"
       → calls take_screenshot → looks correct
       → "Done! Want me to publish it?"

User: "yes"

Agent: → runs loops publish homepage
       → "Published. Visitors will see the fade-ins without ?loops now."
```

### Manual user steps (total)
1. Paste one tag in Webflow Site Settings (once per site)
2. Enable Chrome remote debugging (once ever)
3. Approve debug connection dialog (once per session)

Everything else is handled by the agent via CLI.

## What's Eliminated from v1

| v1 | v2 |
|---|---|
| Cloudflare Worker (Hono) | Convex functions + HTTP actions |
| R2 (script storage) | Convex file storage |
| D1 (log storage) | Eliminated — DevTools MCP |
| KV (metadata + version tracking) | Convex DB |
| SSE polling (KV every 1s) | Convex WebSocket subscriptions |
| logs.json + log polling daemon | Eliminated — DevTools MCP |
| Per-page script tags | Single loader tag |
| .webflow.io domain detection | ?loops URL param |
| loops export | loops publish / unpublish |

## Migration from v1

There are no known external users of v1. The v1 codebase in the CodeFlow repo will be archived (tagged `v1-archive`) and the repo will be restructured for v2. No data migration is needed.

## Phasing

### Phase 1 (this spec)
- Convex backend (DB, file storage, HTTP actions, subscriptions)
- CLI with auth (signup/login/logout/forgot-password), project management, file watcher, publish/unpublish
- Loader script with ?loops activation, filename-based scoping, realtime reload via full page reload
- Chrome DevTools MCP documentation + LOOPS.md guidance
- Multi-project support

### Phase 2 (future)
- Web dashboard with Google/GitHub OAuth
- Project management UI (view scripts, versions, publish status)
- API key management
- Collaborator invitations
- Production serving as paid feature (scripts load without ?loops)
- CDN-backed script serving for high availability
