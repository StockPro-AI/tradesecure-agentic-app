import fs from "fs";
import { chromium } from "playwright";
import { loadConfig, loadSelectors } from "./shared.mjs";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const get = (key) => {
    const index = args.indexOf(`--${key}`);
    return index >= 0 ? args[index + 1] : null;
  };
  return {
    id: get("id"),
    symbol: get("symbol"),
    side: get("side"),
    qty: get("qty"),
  };
};

export const runExecution = async (payload) => {
  const config = loadConfig();
  const selectors = loadSelectors(config.selectorsPath);

  if (!config.executeTrades) {
    await fetch(`${config.dashboardUrl}/api/execution/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: payload.id,
        status: "failed",
        error: "Execution disabled. Set TS_AUTOMATION_EXECUTE=true to allow.",
      }),
    });
    console.log("Execution disabled by config.");
    return;
  }

  if (!fs.existsSync(config.storageStatePath)) {
    throw new Error("No storage state found. Run npm run automation:login first.");
  }

  if (!selectors.orderForm) {
    throw new Error("Missing orderForm selectors.");
  }

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });
  const context = await browser.newContext({
    storageState: config.storageStatePath,
    viewport: config.viewport,
  });
  const page = await context.newPage();
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });

  const form = selectors.orderForm;

  if (form.symbolInput) {
    await page.fill(form.symbolInput, payload.symbol);
  }
  if (form.qtyInput) {
    await page.fill(form.qtyInput, String(payload.qty));
  }
  if (payload.side === "sell" && form.sideSellButton) {
    await page.click(form.sideSellButton);
  } else if (payload.side === "buy" && form.sideBuyButton) {
    await page.click(form.sideBuyButton);
  }
  if (form.submitButton) {
    await page.click(form.submitButton);
  }
  if (form.confirmButton) {
    await page.click(form.confirmButton);
  }

  await browser.close();

  await fetch(`${config.dashboardUrl}/api/execution/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: payload.id, status: "executed" }),
  });

  console.log(`Executed ${payload.side} ${payload.qty} ${payload.symbol}`);
};

const run = async () => {
  const args = parseArgs();
  if (!args.id && (!args.symbol || !args.qty)) {
    throw new Error("Provide --id or --symbol and --qty");
  }

  const config = loadConfig();

  let payload = {
    id: args.id,
    symbol: args.symbol,
    side: args.side ?? "buy",
    qty: Number(args.qty ?? 0),
  };

  if (args.id) {
    const response = await fetch(
      `${config.dashboardUrl}/api/execution/list?status=approved`
    );
    const data = await response.json();
    const match = data.data.find((item) => item.id === args.id);
    if (!match) {
      throw new Error("Execution id not found in approved queue.");
    }
    payload = match;
  }

  await runExecution(payload);
};

if (process.argv[1].includes("execute.mjs")) {
  run().catch(async (error) => {
    console.error("Execution automation failed:", error);
    process.exitCode = 1;
  });
}
