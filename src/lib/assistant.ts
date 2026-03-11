import type { ExecutionIntent, Strategy } from "./store";

type AssistantContext = {
  pending: ExecutionIntent[];
  strategies: Strategy[];
  marketSymbols: string[];
};

type CrayonTextResponse = {
  response: Array<{ type: "text"; text: string }>;
};

const line = (label: string, value: string | number) => `${label}: ${value}`;

export function buildAssistantResponse(
  prompt: string,
  context: AssistantContext
): CrayonTextResponse {
  const promptLower = prompt.toLowerCase();
  const pendingCount = context.pending.length;
  const strategyCount = context.strategies.length;
  const symbols = context.marketSymbols.slice(0, 6).join(", ") || "None";

  const statusLines = [
    line("Pending approvals", pendingCount),
    line("Active strategies", strategyCount),
    line("Latest symbols", symbols),
  ];

  const suggested: string[] = [];
  if (promptLower.includes("snapshot")) {
    suggested.push("Trigger a fresh UI snapshot from the Market Monitor.");
  }
  if (promptLower.includes("backtest")) {
    suggested.push("Run a backtest on the most recent strategy draft.");
  }
  if (promptLower.includes("trade") || promptLower.includes("execute")) {
    suggested.push("Queue a small demo trade and keep it in pending_human.");
  }
  if (suggested.length === 0) {
    suggested.push(
      "Review pending approvals and confirm only if UI data looks aligned."
    );
    suggested.push("Capture a new market snapshot before NY open.");
  }

  const body = [
    "Ops summary",
    ...statusLines.map((value) => `- ${value}`),
    "",
    "Suggested next steps",
    ...suggested.map((value) => `- ${value}`),
    "",
    "Note: This assistant runs in mock mode and does not use external data.",
  ].join("\n");

  return {
    response: [{ type: "text", text: body }],
  };
}
