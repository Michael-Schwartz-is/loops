import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_DIR = join(homedir(), ".loops");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials");

export interface Credentials {
  publicKey: string;
  privateKey: string;
  email: string;
}

export function getCredentials(): Credentials | null {
  try {
    const data = readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function getCredentialsOrThrow(): Credentials {
  const creds = getCredentials();
  if (!creds) {
    console.error("Not logged in. Run: loops signup  or  loops login");
    process.exit(1);
  }
  return creds;
}

export function saveCredentials(creds: Credentials): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

export function deleteCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE);
  }
}
