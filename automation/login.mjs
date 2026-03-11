import readline from "readline";
import { chromium } from "playwright";
import { ensureDir, loadConfig } from "./shared.mjs";

const config = loadConfig();

const promptEnter = () =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Login manually, then press ENTER to save session... ", () => {
      rl.close();
      resolve();
    });
  });

const run = async () => {
  ensureDir(config.storageStatePath);
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.slowMo,
  });
  const context = await browser.newContext({
    viewport: config.viewport,
  });
  const page = await context.newPage();
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });

  if (config.postLoginSelector) {
    await page.waitForSelector(config.postLoginSelector, { timeout: 0 });
  } else {
    await promptEnter();
  }

  await context.storageState({ path: config.storageStatePath });
  await browser.close();
  console.log(`Session saved to ${config.storageStatePath}`);
};

run().catch((error) => {
  console.error("Login automation failed:", error);
  process.exitCode = 1;
});
