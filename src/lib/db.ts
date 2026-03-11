import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dbPath =
  process.env.TS_AGENTIC_DB_PATH ??
  path.join(process.cwd(), "data", "agentic.db");

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const globalForDb = globalThis as typeof globalThis & {
  __tsAgenticDb?: Database.Database;
};

const db =
  globalForDb.__tsAgenticDb ??
  new Database(dbPath, {
    fileMustExist: false,
  });

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS market_data (
    id TEXT PRIMARY KEY,
    captured_at TEXT NOT NULL,
    symbol TEXT NOT NULL,
    price REAL,
    change_pct REAL,
    volume REAL,
    raw_json TEXT,
    source TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backtest_runs (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execution_queue (
    id TEXT PRIMARY KEY,
    strategy_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    context_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL
  );
`);

if (!globalForDb.__tsAgenticDb) {
  globalForDb.__tsAgenticDb = db;
}

export { db, dbPath };
