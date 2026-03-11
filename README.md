# TradeSecure Agentic Control

UI-only control center for monitoring a demo Trading session, testing hypotheses, and running human-in-the-loop execution.
No external market data is used.

## Quick Start
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`

## Environment
Copy `.env.example` to `.env.local` and adjust if needed.

## Automation
See `automation/README.md` for Playwright setup and selector mapping.

### Scripts
- `npm run automation:login`
- `npm run automation:discover`
- `npm run automation:snapshot`
- `npm run automation:execute -- --id <execution_id>`
- `npm run worker:run`

## Notes
- Execution defaults to disabled. Set `TS_AUTOMATION_EXECUTE=true` to allow UI submission.
- The assistant uses mock responses by default.
