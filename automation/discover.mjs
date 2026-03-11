import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { loadConfig, loadSelectors } from "./shared.mjs";

const config = loadConfig();

const buildSelectors = async (page) => {
  return page.evaluate(() => {
    const textScore = (value) => {
      if (!value) return 0;
      const text = value.toLowerCase();
      let score = 0;
      if (text.includes("symbol")) score += 2;
      if (text.includes("price")) score += 2;
      if (text.includes("change")) score += 1;
      if (text.includes("volume")) score += 1;
      return score;
    };

    const findCandidate = () => {
      const candidates = [];
      const containers = [
        ...document.querySelectorAll("table"),
        ...document.querySelectorAll("[role='table']"),
        ...document.querySelectorAll("[class*='table']"),
        ...document.querySelectorAll("[class*='grid']"),
      ];

      containers.forEach((container) => {
        const headers = Array.from(
          container.querySelectorAll("th, [role='columnheader']")
        );
        const headerText = headers.map((h) => h.textContent || "");
        const score = headerText.reduce((sum, value) => sum + textScore(value), 0);
        if (score >= 4) {
          candidates.push({ container, score, headers });
        }
      });

      return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
    };

    const candidate = findCandidate();
    if (!candidate) return null;

    const headerMap = candidate.headers.map((header) =>
      (header.textContent || "").trim().toLowerCase()
    );

    const cellSelector = (label) => {
      const index = headerMap.findIndex((value) => value.includes(label));
      if (index === -1) return null;
      return `:scope > *:nth-child(${index + 1})`;
    };

    return {
      marketTable: {
        row: "tr, [role='row']",
        fields: {
          symbol: cellSelector("symbol"),
          price: cellSelector("price"),
          changePct: cellSelector("change"),
          volume: cellSelector("volume"),
        },
      },
    };
  });
};

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

  const discovered = await buildSelectors(page);
  await browser.close();

  if (!discovered) {
    console.log("No market table candidate found. Update selectors manually.");
    return;
  }

  const selectorsPath = config.selectorsPath;
  const existing = fs.existsSync(selectorsPath)
    ? loadSelectors(selectorsPath)
    : {};
  const merged = { ...existing, ...discovered };

  fs.mkdirSync(path.dirname(selectorsPath), { recursive: true });
  fs.writeFileSync(selectorsPath, JSON.stringify(merged, null, 2));

  console.log(`Selectors updated at ${selectorsPath}`);
  console.log(JSON.stringify(discovered, null, 2));
};

run().catch((error) => {
  console.error("Selector discovery failed:", error);
  process.exitCode = 1;
});
