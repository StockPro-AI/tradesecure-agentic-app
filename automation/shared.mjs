import fs from "fs";
import path from "path";

const cwd = process.cwd();

const parseBool = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const resolvePath = (value, defaultValue) => {
  const input = value ?? defaultValue;
  if (!input) return "";
  return path.isAbsolute(input) ? input : path.join(cwd, input);
};

export function loadConfig() {
  const configPath = resolvePath(
    process.env.TS_AUTOMATION_CONFIG,
    "automation/config.json"
  );
  const configFromFile = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
    : {};

  const headless = parseBool(
    process.env.TS_AUTOMATION_HEADLESS,
    configFromFile.headless ?? false
  );

  const executeTrades = parseBool(
    process.env.TS_AUTOMATION_EXECUTE,
    configFromFile.executeTrades ?? false
  );

  return {
    baseUrl:
      process.env.TS_AUTOMATION_BASE_URL ??
      configFromFile.baseUrl ??
      "https://webtrader.tradesecure.io/",
    dashboardUrl:
      process.env.TS_DASHBOARD_URL ??
      configFromFile.dashboardUrl ??
      "http://localhost:3000",
    headless,
    slowMo:
      Number(process.env.TS_AUTOMATION_SLOWMO ?? configFromFile.slowMo ?? 80) ||
      0,
    viewport: {
      width: Number(
        process.env.TS_AUTOMATION_VIEWPORT_WIDTH ??
          configFromFile.viewport?.width ??
          1440
      ),
      height: Number(
        process.env.TS_AUTOMATION_VIEWPORT_HEIGHT ??
          configFromFile.viewport?.height ??
          900
      ),
    },
    storageStatePath: resolvePath(
      process.env.TS_AUTOMATION_STORAGE,
      configFromFile.storageStatePath ?? "data/automation/storage.json"
    ),
    selectorsPath: resolvePath(
      process.env.TS_AUTOMATION_SELECTORS,
      configFromFile.selectorsPath ?? "automation/selectors.json"
    ),
    postLoginSelector: configFromFile.postLoginSelector ?? null,
    executeTrades,
  };
}

export function loadSelectors(selectorsPath) {
  if (!selectorsPath || !fs.existsSync(selectorsPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(selectorsPath, "utf-8"));
}

export function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
