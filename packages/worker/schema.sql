CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  args TEXT NOT NULL,
  message TEXT,
  stack TEXT,
  url TEXT,
  timestamp TEXT NOT NULL,
  script_version INTEGER DEFAULT 0,
  script TEXT,
  page TEXT,
  user_agent TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_project_timestamp ON logs (project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs (project_id, id);
