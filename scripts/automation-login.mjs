import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const SESSION_PATH = path.join(ROOT, ".local", "session.json");
const ERROR_SCREENSHOT_PATH = path.join(ROOT, ".local", "login-error.png");
const STORAGE_STATE_PATH =
  process.env.TS_AUTOMATION_STORAGE ||
  path.join(ROOT, "data", "automation", "storage.json");

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = rawValue.replace(/^"|"$/g, "");
  }
};

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, ".env.local"));

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const parseBool = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const loginUrl =
  process.env.TRADESECURE_LOGIN_URL || "https://webtrader.tradesecure.io/";
const username = process.env.TRADESECURE_USERNAME || "";
const password = process.env.TRADESECURE_PASSWORD || "";
const postLoginSelector = process.env.TRADESECURE_POST_LOGIN_SELECTOR || "";
const headless = parseBool(process.env.TRADESECURE_HEADLESS, true);

const maskPath = (value) => value.replace(ROOT, ".");

const pickFirstVisible = async (page, selectors) => {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) continue;
    const target = locator.first();
    if (await target.isVisible()) {
      return target;
    }
  }
  return null;
};

const fillField = async (page, selectors, value) => {
  const target = await pickFirstVisible(page, selectors);
  if (!target) return false;
  await target.fill(value);
  return true;
};

const clickButton = async (page, selectors) => {
  const target = await pickFirstVisible(page, selectors);
  if (!target) return false;
  await target.click();
  return true;
};

const getStorageSnapshot = async (page) => {
  const localStorage = await page.evaluate(() => {
    const entries = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) entries.push([key, window.localStorage.getItem(key)]);
    }
    return Object.fromEntries(entries);
  });
  const sessionStorage = await page.evaluate(() => {
    const entries = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key) entries.push([key, window.sessionStorage.getItem(key)]);
    }
    return Object.fromEntries(entries);
  });
  return { localStorage, sessionStorage };
};

const run = async () => {
  if (!username || !password) {
    throw new Error(
      "Fehlende Zugangsdaten: Bitte TRADESECURE_USERNAME und TRADESECURE_PASSWORD setzen."
    );
  }

  ensureDir(SESSION_PATH);
  ensureDir(STORAGE_STATE_PATH);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    const usernameFilled = await fillField(
      page,
      [
        "input[name=\"username\"]",
        "input[name=\"email\"]",
        "input[type=\"email\"]",
        "input[id*=\"user\" i]",
        "input[id*=\"email\" i]",
        "input[placeholder*=\"email\" i]",
        "input[placeholder*=\"user\" i]",
      ],
      username
    );

    const passwordFilled = await fillField(
      page,
      [
        "input[name=\"password\"]",
        "input[type=\"password\"]",
        "input[id*=\"pass\" i]",
        "input[placeholder*=\"pass\" i]",
      ],
      password
    );

    if (!usernameFilled || !passwordFilled) {
      throw new Error(
        "Login-Formularfelder nicht gefunden. Bitte Selektoren in scripts/automation-login.mjs anpassen."
      );
    }

    const submitClicked = await clickButton(page, [
      "button[type=\"submit\"]",
      "button[id*=\"login\" i]",
      "button:has-text(\"Login\")",
      "button:has-text(\"Sign in\")",
      "button:has-text(\"Anmelden\")",
    ]);

    if (!submitClicked) {
      await page.keyboard.press("Enter");
    }

    if (postLoginSelector) {
      await page.waitForSelector(postLoginSelector, { timeout: 60000 });
    } else {
      try {
        await page.waitForURL((url) => !/login|signin|auth/i.test(url.pathname), {
          timeout: 45000,
        });
      } catch {
        // TODO: If the login page does not redirect, set TRADESECURE_POST_LOGIN_SELECTOR.
      }
    }

    await page.waitForLoadState("networkidle");

    const loginFormStillVisible = await page
      .locator("input[type=\"password\"]")
      .isVisible();
    if (loginFormStillVisible) {
      throw new Error(
        "Login offenbar fehlgeschlagen: Login-Formular ist weiterhin sichtbar."
      );
    }

    const cookies = await context.cookies();
    const { localStorage, sessionStorage } = await getStorageSnapshot(page);

    const payload = {
      cookies,
      localStorage,
      sessionStorage,
      capturedAt: new Date().toISOString(),
    };

    fs.writeFileSync(SESSION_PATH, JSON.stringify(payload, null, 2));
    await context.storageState({ path: STORAGE_STATE_PATH });

    console.log(`SESSION_CAPTURED: ${maskPath(SESSION_PATH)}`);
  } catch (error) {
    ensureDir(ERROR_SCREENSHOT_PATH);
    try {
      await page.screenshot({ path: ERROR_SCREENSHOT_PATH, fullPage: true });
    } catch {
      // ignore screenshot errors
    }
    console.error(
      "Login-Automation fehlgeschlagen:",
      error instanceof Error ? error.message : error
    );
    console.error(`Screenshot: ${maskPath(ERROR_SCREENSHOT_PATH)}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
};

run();
