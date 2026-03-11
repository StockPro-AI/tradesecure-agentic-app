import fs from "fs";
import { chromium } from "playwright";
import { ensureDir, loadConfig, loadSelectors } from "./shared.mjs";

const config = loadConfig();
const selectors = loadSelectors(config.selectorsPath);

const run = async () => {
  if (!fs.existsSync(config.storageStatePath)) {
    throw new Error("No storage state found. Run npm run automation:login first.");
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

  const rows = [];
  if (selectors.marketTable?.row && selectors.marketTable?.fields) {
    const fieldSelectors = selectors.marketTable.fields;
    const extracted = await page.$$eval(
      selectors.marketTable.row,
      (elements, fieldSelectors) =>
        elements.map((row) => {
          const getText = (selector) => {
            if (!selector) return "";
            const el = row.querySelector(selector);
            return el ? el.textContent?.trim() ?? "" : "";
          };
          return {
            symbol: getText(fieldSelectors.symbol),
            price: getText(fieldSelectors.price),
            changePct: getText(fieldSelectors.changePct),
            volume: getText(fieldSelectors.volume),
          };
        }),
      fieldSelectors
    );

    for (const item of extracted) {
      if (!item.symbol) continue;
      rows.push({
        symbol: item.symbol,
        price: Number(item.price.replace(/[^\d.-]/g, "")) || null,
        changePct: Number(item.changePct.replace(/[^\d.-]/g, "")) / 100 || null,
        volume: Number(item.volume.replace(/[^\d.-]/g, "")) || null,
      });
    }
  } else {
    ensureDir("data/automation/snapshot.png");
    await page.screenshot({ path: "data/automation/snapshot.png", fullPage: true });
    rows.push({
      symbol: "UI_ONLY",
      price: null,
      changePct: null,
      volume: null,
      raw: { note: "No selectors configured. Screenshot saved." },
    });
  }

  await browser.close();

  await fetch(`${config.dashboardUrl}/api/market/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "ui", rows }),
  });

  console.log(`Snapshot sent (${rows.length} rows).`);
};

run().catch((error) => {
  console.error("Snapshot automation failed:", error);
  process.exitCode = 1;
});
