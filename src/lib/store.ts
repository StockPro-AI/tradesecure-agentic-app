import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { db } from "./db";

export type MarketRow = {
  symbol: string;
  price?: number | null;
  changePct?: number | null;
  volume?: number | null;
  raw?: Record<string, unknown> | null;
  capturedAt?: string;
  source?: string;
};

export type Strategy = {
  id: string;
  name: string;
  hypothesis: string;
  status: "draft" | "approved" | "deployed" | "rejected";
  created_at: string;
  updated_at: string;
};

export type BacktestRun = {
  id: string;
  strategy_id: string;
  metrics_json: string;
  status: "pass" | "fail";
  created_at: string;
};

export type ExecutionIntent = {
  id: string;
  strategy_id: string | null;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  status:
    | "pending_human"
    | "approved"
    | "executed"
    | "rejected"
    | "failed";
  created_at: string;
  updated_at: string;
  last_error: string | null;
};

export type SystemEvent = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  context_json: string | null;
  created_at: string;
};

export type AssistantSettings = {
  provider: string;
  model: string;
  base_url: string | null;
  api_key: string | null;
  mode: string;
};

export type AssistantSettingsSafe = {
  provider: string;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  mode: string;
};

export type AutomationStatus = {
  hasSession: boolean;
  storagePath: string;
};

const nowIso = () => new Date().toISOString();
const assistantSettingKeys = {
  provider: "assistant.provider",
  model: "assistant.model",
  baseUrl: "assistant.base_url",
  apiKey: "assistant.api_key",
  mode: "assistant.mode",
};
const defaultBaseUrls: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
};

const fromEnv = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function getSettingValue(key: string) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSettingValue(key: string, value: string | null) {
  if (value === null || value === undefined || value === "") {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }

  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, nowIso());
}

export function getAssistantSettings(): AssistantSettings {
  const provider =
    getSettingValue(assistantSettingKeys.provider) ??
    fromEnv(process.env.TS_ASSISTANT_PROVIDER) ??
    "ollama";
  const model =
    getSettingValue(assistantSettingKeys.model) ??
    fromEnv(process.env.TS_ASSISTANT_MODEL) ??
    "";
  const baseUrl =
    getSettingValue(assistantSettingKeys.baseUrl) ??
    fromEnv(process.env.TS_ASSISTANT_BASE_URL) ??
    defaultBaseUrls[provider] ??
    null;
  const apiKey =
    getSettingValue(assistantSettingKeys.apiKey) ??
    fromEnv(process.env.TS_ASSISTANT_API_KEY) ??
    (provider === "openai"
      ? fromEnv(process.env.OPENAI_API_KEY)
      : null) ??
    (provider === "openrouter"
      ? fromEnv(process.env.OPENROUTER_API_KEY)
      : null) ??
    (provider === "ollama" ? fromEnv(process.env.OLLAMA_API_KEY) : null) ??
    null;
  const mode =
    getSettingValue(assistantSettingKeys.mode) ??
    fromEnv(process.env.TS_ASSISTANT_MODE) ??
    "auto";

  return {
    provider,
    model,
    base_url: baseUrl,
    api_key: apiKey,
    mode,
  };
}

export function getAssistantSettingsSafe(): AssistantSettingsSafe {
  const settings = getAssistantSettings();
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.base_url,
    hasApiKey: Boolean(settings.api_key),
    mode: settings.mode,
  };
}

export function updateAssistantSettings(input: Partial<AssistantSettings>) {
  if (input.provider !== undefined) {
    setSettingValue(assistantSettingKeys.provider, input.provider);
  }
  if (input.model !== undefined) {
    setSettingValue(assistantSettingKeys.model, input.model);
  }
  if (input.base_url !== undefined) {
    setSettingValue(assistantSettingKeys.baseUrl, input.base_url);
  } else if (input.provider !== undefined) {
    const fallback = defaultBaseUrls[input.provider];
    if (fallback) {
      setSettingValue(assistantSettingKeys.baseUrl, fallback);
    }
  }
  if (input.api_key !== undefined) {
    setSettingValue(assistantSettingKeys.apiKey, input.api_key);
  }
  if (input.mode !== undefined) {
    setSettingValue(assistantSettingKeys.mode, input.mode);
  }

  logEvent("info", "Assistant settings updated", {
    provider: input.provider,
    model: input.model,
    baseUrl: input.base_url ? true : undefined,
    apiKeyUpdated: input.api_key ? true : undefined,
    mode: input.mode,
  });
}

export function getAutomationStatus(): AutomationStatus {
  const storagePath =
    fromEnv(process.env.TS_AUTOMATION_STORAGE) ??
    path.join(process.cwd(), "data", "automation", "storage.json");
  return {
    hasSession: fs.existsSync(storagePath),
    storagePath,
  };
}

export function logEvent(
  level: SystemEvent["level"],
  message: string,
  context?: Record<string, unknown>
) {
  const event: SystemEvent = {
    id: randomUUID(),
    level,
    message,
    context_json: context ? JSON.stringify(context) : null,
    created_at: nowIso(),
  };
  db.prepare(
    `INSERT INTO system_events (id, level, message, context_json, created_at)
     VALUES (@id, @level, @message, @context_json, @created_at)`
  ).run(event);
}

export function insertMarketSnapshot(rows: MarketRow[], source = "ui") {
  const capturedAt = nowIso();
  const insert = db.prepare(
    `INSERT INTO market_data
     (id, captured_at, symbol, price, change_pct, volume, raw_json, source)
     VALUES (@id, @captured_at, @symbol, @price, @change_pct, @volume, @raw_json, @source)`
  );

  const transaction = db.transaction((items: MarketRow[]) => {
    for (const row of items) {
      insert.run({
        id: randomUUID(),
        captured_at: row.capturedAt ?? capturedAt,
        symbol: row.symbol,
        price: row.price ?? null,
        change_pct: row.changePct ?? null,
        volume: row.volume ?? null,
        raw_json: row.raw ? JSON.stringify(row.raw) : null,
        source: row.source ?? source,
      });
    }
  });

  transaction(rows);
  logEvent("info", "Market snapshot stored", {
    count: rows.length,
    source,
  });
}

export function listLatestMarketData() {
  return db
    .prepare(
      `SELECT * FROM market_data AS m
       WHERE captured_at = (
         SELECT MAX(captured_at) FROM market_data WHERE symbol = m.symbol
       )
       ORDER BY symbol`
    )
    .all();
}

export function createStrategy(name: string, hypothesis: string): Strategy {
  const createdAt = nowIso();
  const strategy: Strategy = {
    id: randomUUID(),
    name,
    hypothesis,
    status: "draft",
    created_at: createdAt,
    updated_at: createdAt,
  };
  db.prepare(
    `INSERT INTO strategies
     (id, name, hypothesis, status, created_at, updated_at)
     VALUES (@id, @name, @hypothesis, @status, @created_at, @updated_at)`
  ).run(strategy);
  logEvent("info", "Strategy created", {
    strategyId: strategy.id,
    name,
  });
  return strategy;
}

export function listStrategies(limit = 8): Strategy[] {
  return db
    .prepare(
      `SELECT * FROM strategies
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Strategy[];
}

function deterministicMetric(seed: string, min: number, max: number) {
  const hash = createHash("sha256").update(seed).digest("hex");
  const n = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  return min + (max - min) * n;
}

export function runMockBacktest(strategyId: string): BacktestRun {
  const sharpe = Number(deterministicMetric(strategyId, 0.6, 2.4).toFixed(2));
  const maxDd = Number(deterministicMetric(strategyId + "dd", 0.08, 0.26).toFixed(2));
  const winRate = Number(
    deterministicMetric(strategyId + "wr", 0.42, 0.68).toFixed(2)
  );
  const totalTrades = Math.round(
    deterministicMetric(strategyId + "tt", 80, 240)
  );

  const status: BacktestRun["status"] =
    sharpe >= 1.2 && maxDd <= 0.15 && totalTrades > 100 ? "pass" : "fail";

  const run: BacktestRun = {
    id: randomUUID(),
    strategy_id: strategyId,
    metrics_json: JSON.stringify({
      sharpe,
      max_dd: maxDd,
      win_rate: winRate,
      total_trades: totalTrades,
    }),
    status,
    created_at: nowIso(),
  };

  db.prepare(
    `INSERT INTO backtest_runs
     (id, strategy_id, metrics_json, status, created_at)
     VALUES (@id, @strategy_id, @metrics_json, @status, @created_at)`
  ).run(run);

  logEvent("info", "Backtest completed", {
    strategyId,
    status,
  });

  return run;
}

export function listBacktests(limit = 6): BacktestRun[] {
  return db
    .prepare(
      `SELECT * FROM backtest_runs
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as BacktestRun[];
}

export function createExecutionIntent(input: {
  strategyId?: string | null;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
}): ExecutionIntent {
  const createdAt = nowIso();
  const intent: ExecutionIntent = {
    id: randomUUID(),
    strategy_id: input.strategyId ?? null,
    symbol: input.symbol,
    side: input.side,
    qty: input.qty,
    status: "pending_human",
    created_at: createdAt,
    updated_at: createdAt,
    last_error: null,
  };

  db.prepare(
    `INSERT INTO execution_queue
     (id, strategy_id, symbol, side, qty, status, created_at, updated_at, last_error)
     VALUES (@id, @strategy_id, @symbol, @side, @qty, @status, @created_at, @updated_at, @last_error)`
  ).run(intent);

  logEvent("info", "Execution intent queued", {
    executionId: intent.id,
    symbol: intent.symbol,
    side: intent.side,
    qty: intent.qty,
  });

  return intent;
}

export function listExecutionQueue(status?: ExecutionIntent["status"]) {
  if (status) {
    return db
      .prepare(
        `SELECT * FROM execution_queue
         WHERE status = ?
         ORDER BY created_at DESC`
      )
      .all(status) as ExecutionIntent[];
  }

  return db
    .prepare(
      `SELECT * FROM execution_queue
       ORDER BY created_at DESC
       LIMIT 12`
    )
    .all() as ExecutionIntent[];
}

export function updateExecutionStatus(
  id: string,
  status: ExecutionIntent["status"],
  error?: string | null
) {
  db.prepare(
    `UPDATE execution_queue
     SET status = ?, updated_at = ?, last_error = ?
     WHERE id = ?`
  ).run(status, nowIso(), error ?? null, id);

  logEvent(
    status === "failed" ? "error" : "info",
    "Execution status updated",
    { id, status, error }
  );
}

export function approveExecution(id: string) {
  updateExecutionStatus(id, "approved");
}

export function getDashboardData() {
  return {
    market: listLatestMarketData(),
    strategies: listStrategies(),
    backtests: listBacktests(),
    queue: listExecutionQueue(),
    events: db
      .prepare(
        `SELECT * FROM system_events
         ORDER BY created_at DESC
         LIMIT 10`
      )
      .all() as SystemEvent[],
  };
}

export function seedIfEmpty() {
  const countRow = db
    .prepare("SELECT COUNT(1) as count FROM market_data")
    .get() as { count: number };
  if (countRow.count > 0) {
    return;
  }

  insertMarketSnapshot([
    { symbol: "SPY", price: 509.22, changePct: 0.18, volume: 18432211 },
    { symbol: "QQQ", price: 444.8, changePct: -0.12, volume: 12988102 },
    { symbol: "NVDA", price: 920.41, changePct: 0.44, volume: 33210011 },
    { symbol: "TSLA", price: 236.8, changePct: -0.62, volume: 27899123 },
  ]);

  createStrategy(
    "VWAP Bounce Core",
    "Price reclaims VWAP after a 1.5 ATR flush with rising volume; target prior session VWAP."
  );
  createStrategy(
    "Opening Range Break",
    "Trade 5m ORB with volume confirmation and stop below OR low."
  );
  logEvent("info", "Seed data initialized");
}

seedIfEmpty();
