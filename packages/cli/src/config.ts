import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectConfig } from "@loops/shared";

const CONFIG_FILE = ".loops.json";

export async function loadConfig(dir: string): Promise<ProjectConfig | null> {
  try {
    const raw = await fs.readFile(path.join(dir, CONFIG_FILE), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveConfig(
  dir: string,
  config: ProjectConfig
): Promise<void> {
  await fs.writeFile(
    path.join(dir, CONFIG_FILE),
    JSON.stringify(config, null, 2) + "\n"
  );
}

export async function findProjects(
  baseDir: string
): Promise<{ dir: string; config: ProjectConfig }[]> {
  const projects: { dir: string; config: ProjectConfig }[] = [];

  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = path.join(baseDir, entry.name);
    const config = await loadConfig(dir);
    if (config) {
      projects.push({ dir, config });
    }
  }

  return projects;
}
