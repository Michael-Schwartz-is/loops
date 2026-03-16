/**
 * Generates the loader JavaScript served by the <script> tag.
 * Two modes:
 * - Production (no ?loops): minimal, fetches and injects published scripts only
 * - Dev (?loops): loads ConvexClient from CDN, subscribes for realtime reload
 */

export function generateLoader(
  convexUrl: string,
  publicKey: string,
  projectId: string,
  baseUrl: string
): string {
  return `(function() {
  "use strict";

  var PK = "${publicKey}";
  var PROJECT = "${projectId}";
  var BASE = "${baseUrl}";
  var CONVEX_URL = "${convexUrl}";

  // Check for ?loops param
  var isDevMode = new URLSearchParams(window.location.search).has("loops");

  // Page scoping: get current slug
  var pathname = window.location.pathname.replace(/\\/+$/, "");
  var slug = pathname === "" || pathname === "/" ? "homepage" : pathname.split("/").pop().toLowerCase();

  function shouldLoadScript(scriptName) {
    var name = scriptName.toLowerCase();
    if (name.startsWith("global-")) return true;
    if (name === slug) return true;
    if (slug === "homepage" && (name === "home" || name === "index")) return true;
    return false;
  }

  function injectScript(name, code) {
    if (!shouldLoadScript(name)) return;
    var el = document.createElement("script");
    el.setAttribute("data-loops-script", name);
    el.textContent = "(function(){" + code + "})();";
    document.head.appendChild(el);
  }

  function loadScripts(mode) {
    return fetch(BASE + "/scripts/" + PK + "/" + PROJECT + "?mode=" + mode)
      .then(function(r) { return r.json(); })
      .then(function(scripts) {
        var promises = scripts.map(function(s) {
          return fetch(BASE + "/script/" + PK + "/" + PROJECT + "/" + s.scriptName + "?mode=" + mode)
            .then(function(r) { return r.text(); })
            .then(function(code) { injectScript(s.scriptName, code); });
        });
        return Promise.all(promises);
      });
  }

  if (isDevMode) {
    // Dev mode: load WIP scripts, then load ConvexClient for realtime reload
    loadScripts("wip").then(function() {
      var s = document.createElement("script");
      s.src = "https://unpkg.com/convex@latest/dist/browser.bundle.js";
      s.onload = function() {
        var client = new window.Convex.ConvexClient(CONVEX_URL);
        var lastVersion = 0;
        client.onUpdate(
          "scripts:getProjectVersion",
          { publicKey: PK, projectId: PROJECT },
          function(version) {
            if (lastVersion > 0 && version !== lastVersion) {
              window.location.reload();
            }
            lastVersion = version;
          }
        );
      };
      document.head.appendChild(s);
    });
  } else {
    // Production mode: load published scripts only
    loadScripts("published");
  }
})();`;
}
