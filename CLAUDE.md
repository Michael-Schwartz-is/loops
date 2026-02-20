# Loops

Live coding tool for Webflow. Edit scripts locally, they sync to the cloud and run on your Webflow staging site. Logs flow back so you can debug.

## Project Structure

```
packages/
  shared/    — Shared TypeScript types (LogEntry, ProjectConfig, ProjectMeta)
  worker/    — Cloudflare Worker API (Hono + R2 + D1 + KV)
  cli/       — CLI tool (init, add, start, status, export)
```

## Development

```bash
npm install
npm run build -w packages/cli

# Run worker locally:
cd packages/worker && npx wrangler dev --local

# In another terminal, test:
cd packages/cli && node dist/index.js init myproject --api-url http://localhost:8787
```

## Production

- **Worker URL:** https://loops.mike-a99.workers.dev

## Deploying the Worker

1. `npx wrangler login`
2. Create resources:
   - `npx wrangler r2 bucket create loops-scripts`
   - `npx wrangler d1 create loops-logs` → copy the database_id into wrangler.toml
   - `npx wrangler kv namespace create META` → copy the id into wrangler.toml
3. Apply D1 schema: `npx wrangler d1 execute loops-logs --remote --file=schema.sql`
4. `npx wrangler deploy`
