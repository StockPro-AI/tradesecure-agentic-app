# Automation Notes

This folder contains normal (non-stealth) Playwright automation scripts for the demo workflow.
Selectors are intentionally placeholders. You must map them to the TradeSecure UI.

## Setup
1. Copy `config.example.json` to `config.json`.
2. Copy `selectors.example.json` to `selectors.json` and update selectors.
3. Start the dashboard with `npm run dev`.
4. Install Playwright browsers if needed: `npx playwright install chromium`.

## Login
`npm run automation:login`

This opens the browser and lets you login manually. After login, the session is saved to the storage file.

## Snapshot
`npm run automation:snapshot`

Captures a market snapshot using the selectors and posts it to the dashboard.

## Discover selectors (heuristic)
`npm run automation:discover`

Attempts to infer a market table selector based on header text. Review the generated `selectors.json`.

## Execution (demo only)
`npm run automation:execute -- --id <execution_id>`

Set `TS_AUTOMATION_EXECUTE=true` in your environment to allow UI submission.

## Worker
`npm run worker:run`

Processes all approved executions (one pass).
