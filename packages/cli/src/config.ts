import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface ProjectConfig {
  projectId: string;
  publicKey: string;
}

export function readConfig(projectDir: string): ProjectConfig {
  const configPath = join(projectDir, ".loops.json");
  if (!existsSync(configPath)) {
    throw new Error(`No .loops.json found in ${projectDir}`);
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

export function writeConfig(projectDir: string, config: ProjectConfig): void {
  const configPath = join(projectDir, ".loops.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function findProjects(baseDir: string): string[] {
  const projects: string[] = [];
  try {
    const entries = readdirSync(baseDir);
    for (const entry of entries) {
      const fullPath = join(baseDir, entry);
      if (statSync(fullPath).isDirectory()) {
        const configPath = join(fullPath, ".loops.json");
        if (existsSync(configPath)) {
          projects.push(fullPath);
        }
      }
    }
  } catch {
    // ignore
  }
  return projects;
}

export function findProjectDir(dir: string): string | null {
  let current = dir;
  while (true) {
    if (existsSync(join(current, ".loops.json"))) return current;
    const parent = join(current, "..");
    if (parent === current) return null;
    current = parent;
  }
}
