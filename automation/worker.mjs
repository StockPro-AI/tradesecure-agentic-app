import { loadConfig } from "./shared.mjs";
import { runExecution } from "./execute.mjs";

const run = async () => {
  const config = loadConfig();
  const response = await fetch(
    `${config.dashboardUrl}/api/execution/list?status=approved`
  );
  const data = await response.json();
  const approved = data.data ?? [];

  if (approved.length === 0) {
    console.log("No approved executions found.");
    return;
  }

  for (const intent of approved) {
    try {
      await runExecution(intent);
    } catch (error) {
      console.error(`Execution failed for ${intent.id}:`, error);
      await fetch(`${config.dashboardUrl}/api/execution/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: intent.id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }
};

run().catch((error) => {
  console.error("Worker failed:", error);
  process.exitCode = 1;
});
