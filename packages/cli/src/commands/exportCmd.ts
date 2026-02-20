import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config.js";

export async function exportCommand(
  projectName: string,
  opts: { inline?: boolean }
) {
  const projectDir = path.resolve(projectName);
  const config = await loadConfig(projectDir);

  if (!config) {
    console.error(
      `No .loops.json found in ${projectDir}. Run "loops init ${projectName}" first.`
    );
    process.exit(1);
  }

  if (config.scripts.length === 0) {
    console.log("No scripts to export.");
    return;
  }

  if (opts.inline) {
    // Output code ready to paste into Webflow custom code
    console.log("<!-- Loops export: paste in Webflow Custom Code -->");
    console.log("<script>");

    for (const scriptName of config.scripts) {
      const scriptPath = path.join(
        projectDir,
        "scripts",
        `${scriptName}.js`
      );
      const code = await fs.readFile(scriptPath, "utf-8");
      console.log(`\n// === ${scriptName}.js ===`);
      console.log(`(function(){`);
      console.log(code);
      console.log(`})();`);
    }

    console.log("</script>");
  } else {
    // Export as individual files
    const exportDir = path.join(projectDir, "export");
    await fs.mkdir(exportDir, { recursive: true });

    for (const scriptName of config.scripts) {
      const srcPath = path.join(projectDir, "scripts", `${scriptName}.js`);
      const code = await fs.readFile(srcPath, "utf-8");
      const wrapped = `(function(){\n${code}\n})();\n`;

      const destPath = path.join(exportDir, `${scriptName}.js`);
      await fs.writeFile(destPath, wrapped);
      console.log(`  Exported: export/${scriptName}.js`);
    }

    console.log(`\n${config.scripts.length} script(s) exported to ${exportDir}`);
  }
}
