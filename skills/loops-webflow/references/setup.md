# Loops Setup Reference

Complete setup guide for first-time users. Walk through each step with the user.

## Step 1: Create Account

```bash
loops signup
# Prompts for email and password
# Saves credentials to ~/.loops/credentials
```

Verify:
```bash
cat ~/.loops/credentials
# Should show JSON with email, publicKey, privateKey
```

## Step 2: Create a Project

Navigate to where you want your project directory, then:

```bash
loops init <site-name>
# Example: loops init acme-corp
```

This creates:
```
<site-name>/
├── .loops.json     # Project config (projectId + publicKey)
├── LOOPS.md        # Project guide for AI context
└── scripts/        # Your JavaScript files go here
```

It also prints a loader `<script>` tag. Copy it.

## Step 3: Add Loader to Webflow

1. Open Webflow → your site → Site Settings
2. Go to Custom Code → Before `</body>` tag
3. Paste the `<script>` tag from `loops init` output
4. Publish the staging site

The loader tag looks like:
```html
<script src="https://<deployment>.convex.site/loader/<publicKey>/<projectId>"></script>
```

## Step 4: Set Up Chrome DevTools MCP

This gives the AI access to browser console, screenshots, and DOM evaluation.

```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect
```

Then open Chrome with remote debugging:
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Navigate to your Webflow staging site with `?loops` appended to the URL.

## Step 5: Add Your First Script

```bash
cd <site-name>
loops add homepage
# Creates scripts/homepage.js
```

## Step 6: Start the Watcher

```bash
# From the parent directory (watches all projects)
loops start
```

Or from inside the project directory.

## Step 7: Verify the Loop

1. Edit `scripts/homepage.js` — add a `console.log("hello")`
2. Save the file
3. Check the watcher terminal — should show `✓ Pushed`
4. In the browser (with `?loops`), open console — should see "hello"
5. Or use Chrome DevTools MCP: `list_console_messages`

## Login on Another Machine

```bash
loops login
# Prompts for email and password
# Regenerates API key and saves to ~/.loops/credentials
```

## Password Reset

```bash
loops forgot-password
# Prompts for email, sends 6-digit code, prompts for new password
```
