# Loops

Live coding tool for Webflow. Edit scripts locally, they sync to the cloud via Convex and run on your Webflow staging site. Chrome DevTools MCP provides AI feedback.

## Project Structure

```
packages/
  shared/    — Shared TypeScript types (ProjectConfig, Credentials)
  convex/    — Convex backend (DB, file storage, HTTP actions)
  cli/       — CLI tool (signup, login, init, add, start, status, publish, unpublish)
```

## Development

```bash
npm install
npm run build -w packages/cli

# Run Convex dev server:
cd packages/convex && npx convex dev

# In another terminal, test CLI:
cd packages/cli && node dist/index.js --help
```

## Architecture

- **Backend:** Convex (replaces Cloudflare Worker + R2 + D1 + KV)
- **Auth:** Email/password with scrypt hashing, API keys with SHA-256
- **Script storage:** Convex file storage (WIP + published versions)
- **Realtime reload:** Convex WebSocket subscriptions via ConvexClient in loader
- **Feedback:** Chrome DevTools MCP (replaces log pipeline)

## CLI Commands

- `loops signup` / `loops login` / `loops logout` — Account management
- `loops forgot-password` — Password reset via email
- `loops init <site-name>` — Create project, get loader tag
- `loops add <script-name>` — Add a script file
- `loops remove <script-name>` — Remove a script
- `loops start` — Watch & sync all projects
- `loops status` — Show projects and script versions
- `loops publish <script>` / `loops unpublish <script>` — Production deployment

## Deploying

```bash
cd packages/convex && npx convex deploy
```
