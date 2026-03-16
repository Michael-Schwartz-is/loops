---
name: loops-webflow
description: Use when building, editing, or debugging JavaScript for a Webflow site using the Loops CLI. Covers the full workflow from project setup through live coding with real-time browser feedback via Chrome DevTools MCP.
---

# Loops — Live Coding for Webflow

## Overview

Loops lets you edit JavaScript locally and sync it to a Webflow staging site in real time. You write scripts, a file watcher pushes them to the cloud, and the browser reloads automatically. Chrome DevTools MCP gives you console output, screenshots, and DOM access without leaving the terminal.

**Your job:** Write behavior scripts for Webflow sites. The HTML/CSS is built in Webflow — you add animations, interactions, form logic, and API calls.

## When to Use This Skill

- User asks to add custom code/scripts to a Webflow site
- User asks to build interactions, animations, or form logic for Webflow
- User mentions "Loops" in the context of Webflow scripting
- You're working in a directory with a `.loops.json` file
- You're editing files in a `scripts/` directory inside a Loops project

## Prerequisites

Before first use, the user needs:
1. A Loops account (`loops signup`)
2. At least one initialized project (`loops init <site-name>`)
3. The loader `<script>` tag pasted into Webflow Site Settings → Custom Code → Before `</body>`
4. Chrome DevTools MCP configured for browser feedback

Check if prerequisites are met:
```bash
# Check if logged in
cat ~/.loops/credentials 2>/dev/null

# Check if in a project
cat .loops.json 2>/dev/null || cat ../.loops.json 2>/dev/null
```

If not set up, guide the user through setup (see [Setup Reference](references/setup.md)).

## The Workflow

### Step 1: Start the Watcher

Before writing any code, ensure the watcher is running:

```bash
loops start
```

This watches all projects in the current directory. Every file save pushes to Convex instantly. The browser reloads automatically when visiting the staging site with `?loops` in the URL.

**Verify it's working:** Save a file → you should see `✓ Pushed <project>/<script>.js` in the terminal.

### Step 2: Understand the Page

Before writing code, you MUST understand the live DOM. Use Chrome DevTools MCP:

```
# Take a screenshot to see the current page
take_screenshot

# Evaluate a selector to find elements
evaluate_script: document.querySelectorAll('.hero-section_home').length

# Get all class names on the page
evaluate_script: [...new Set([...document.querySelectorAll('*')].flatMap(el => [...el.classList]))].sort().join('\n')
```

**Never guess class names.** Webflow generates specific class names like `.hero-section_home`, `.nav_link`, `.footer_wrapper`. Always verify selectors exist before using them.

### Step 3: Write the Script

Create or edit a script file:

```bash
# Create a new script (if it doesn't exist)
loops add <script-name>

# Or directly edit an existing one
# File: scripts/<script-name>.js
```

#### Script Naming = Page Scoping

Script names determine which pages they load on:

| Script name | Loads on |
|-------------|----------|
| `homepage.js` | Homepage only (`/`) |
| `about.js` | `/about` page only |
| `pricing.js` | `/pricing` page only |
| `global-nav.js` | **Every page** (any `global-*` prefix) |
| `global-analytics.js` | **Every page** |

### Step 4: Verify with Chrome DevTools MCP

After saving (which auto-pushes and reloads), verify your changes:

```
# Check console output from your script
list_console_messages

# Take a screenshot to visually verify
take_screenshot

# Test a specific interaction
evaluate_script: document.querySelector('.nav_menu').style.display
```

### Step 5: Iterate

The feedback loop is:

1. Edit `scripts/<name>.js`
2. Save → auto-push → auto-reload (~1 second)
3. `list_console_messages` → check output
4. `take_screenshot` → verify visually
5. Repeat

### Step 6: Publish

When the script is ready for production visitors (without `?loops`):

```bash
loops publish <script-name>
```

To pull back from production:

```bash
loops unpublish <script-name>
```

## Writing Rules

These are non-negotiable. Violating them produces broken Webflow sites.

### DO

- **Select by Webflow class names:** `.hero-section_home`, `.nav_link`, `.footer_wrapper`
- **Add behavior only:** animations, interactions, form handling, API calls
- **Log at key steps:** `console.log("Found", els.length, ".card elements")`
- **Verify selectors exist before using them:**
  ```javascript
  const cards = document.querySelectorAll('.card_item');
  if (!cards.length) {
    console.log("WARNING: .card_item not found on this page");
    return;
  }
  ```
- **Use GSAP/ScrollTrigger for animations** (load from CDN in the script if needed)
- **Work with the existing DOM** — query, animate, enhance

### DO NOT

- **Never generate HTML with JavaScript.** The HTML/CSS lives in Webflow.
- **Never use `DOMContentLoaded`.** Scripts load before `</body>`, DOM is already ready.
- **Never replace DOM elements.** Webflow manages the DOM structure.
- **Never guess class names.** Always verify with Chrome DevTools MCP first.
- **Never hardcode URLs** that may differ between staging and production.

## Script Template

When creating a new script, use this pattern:

```javascript
// <script-name>.js — <project-id>
// This script loads on the "<page>" page

(function() {
  // 1. Select elements
  const els = document.querySelectorAll('.target-class');
  console.log("<script-name>: found", els.length, ".target-class elements");

  if (!els.length) {
    console.log("<script-name>: no elements found, exiting");
    return;
  }

  // 2. Add behavior
  els.forEach(el => {
    // Your code here
  });

  console.log("<script-name>: setup complete");
})();
```

## Common Patterns

### GSAP Animation
```javascript
// Load GSAP if not already available
if (!window.gsap) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  script.onload = () => initAnimations();
  document.head.appendChild(script);
} else {
  initAnimations();
}

function initAnimations() {
  gsap.from('.card_item', {
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out'
  });
  console.log("Animations initialized");
}
```

### Form Handling
```javascript
const form = document.querySelector('.contact-form');
if (!form) { console.log("No .contact-form found"); return; }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  console.log("Form submitted:", JSON.stringify(data));

  try {
    const res = await fetch('https://api.example.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    console.log("Form response:", res.status);
  } catch (err) {
    console.error("Form error:", err.message);
  }
});
```

### Detecting Webflow IX2 State
```javascript
// Webflow Interactions 2 uses inline styles, not classes
const menu = document.querySelector('.nav_menu');
const isOpen = menu && menu.style.display !== 'none' && menu.style.height !== '0px';
console.log("Menu state:", isOpen ? "open" : "closed");
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Script not loading | Is watcher running? Check `loops start` output |
| No console output | Is `?loops` in the URL? (dev mode required) |
| Wrong page | Script name must match the page slug |
| Elements not found | Verify class names with `evaluate_script` |
| Stale code | Hard refresh the browser (`Cmd+Shift+R`) |
| Push failed | Check `loops status` for auth/connection issues |

## CLI Quick Reference

| Command | What it does |
|---------|-------------|
| `loops signup` | Create account |
| `loops login` | Log in (regenerates API key) |
| `loops init <site>` | Create project, get loader tag |
| `loops add <script>` | Create a new script file |
| `loops remove <script>` | Delete script locally + remotely |
| `loops start` | Watch & sync all projects |
| `loops status` | Show projects, scripts, versions |
| `loops publish <script>` | Push to production |
| `loops unpublish <script>` | Pull from production |
| `loops logout` | Remove credentials |
| `loops forgot-password` | Reset password via email |
