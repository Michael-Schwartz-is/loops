export interface LogEntry {
  type: "log" | "warn" | "error" | "unhandled-error" | "unhandled-rejection" | "network-error" | "page-html";
  args: unknown[];
  message?: string;
  stack?: string;
  url?: string;
  timestamp: string;
  scriptVersion: number;
  script?: string;
  page?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ProjectConfig {
  name: string;
  projectId: string;
  apiUrl: string;
  authToken: string;
  scripts: string[];
}

export interface ProjectMeta {
  name: string;
  version: number;
  scripts: string[];
  createdAt: string;
  updatedAt: string;
}
