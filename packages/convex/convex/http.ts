import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { generateLoader } from "./loader";

const http = httpRouter();

// Helper to parse URL segments after a prefix
function parseSegments(pathname: string, prefix: string): string[] {
  const rest = pathname.slice(prefix.length);
  return rest.split("/").filter(Boolean);
}

// Serve the loader script: /loader/{publicKey}/{projectId}
http.route({
  pathPrefix: "/loader/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = parseSegments(url.pathname, "/loader/");
    const publicKey = segments[0];
    const projectId = segments[1];

    if (!publicKey || !projectId) {
      return new Response("Not found", { status: 404 });
    }

    // Derive .convex.cloud URL from .convex.site origin
    const siteOrigin = url.origin;
    const convexUrl = siteOrigin.replace(".convex.site", ".convex.cloud");

    const loaderCode = generateLoader(
      convexUrl,
      publicKey,
      projectId,
      siteOrigin
    );

    return new Response(loaderCode, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// List scripts for a project: /scripts/{pk}/{projectId}?mode=wip|published
http.route({
  pathPrefix: "/scripts/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = parseSegments(url.pathname, "/scripts/");
    const publicKey = segments[0];
    const projectId = segments[1];
    const mode = url.searchParams.get("mode") || "published";

    if (!publicKey || !projectId) {
      return new Response("Not found", { status: 404 });
    }

    let scripts;
    if (mode === "wip") {
      scripts = await ctx.runQuery(api.scripts.getWipScripts, {
        publicKey,
        projectId,
      });
    } else {
      scripts = await ctx.runQuery(api.scripts.getPublishedScripts, {
        publicKey,
        projectId,
      });
    }

    return new Response(JSON.stringify(scripts), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// Serve individual script content: /script/{pk}/{projectId}/{scriptName}?mode=wip|published
http.route({
  pathPrefix: "/script/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const segments = parseSegments(url.pathname, "/script/");
    const publicKey = segments[0];
    const projectId = segments[1];
    const scriptName = segments[2];
    const mode = url.searchParams.get("mode") || "published";

    if (!publicKey || !projectId || !scriptName) {
      return new Response("Not found", { status: 404 });
    }

    const storageId = await ctx.runQuery(api.scripts.getScriptStorageId, {
      publicKey,
      projectId,
      scriptName,
      mode,
    });

    if (!storageId) {
      return new Response("Script not found", { status: 404 });
    }

    const blob = await ctx.storage.get(storageId);
    if (!blob) {
      return new Response("Script file not found", { status: 404 });
    }

    const code = await blob.text();

    return new Response(code, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control":
          mode === "published" ? "public, max-age=60" : "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
