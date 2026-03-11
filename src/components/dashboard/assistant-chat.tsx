"use client";

import { C1Chat, ThemeProvider } from "@thesysai/genui-sdk";

export function AssistantChat() {
  return (
    <ThemeProvider mode="light">
      <div className="h-[520px] w-full rounded-2xl border border-border/60 bg-white/70 shadow-sm backdrop-blur">
        <C1Chat
          apiUrl="/api/assistant/ask"
          formFactor="side-panel"
          agentName={process.env.NEXT_PUBLIC_AGENT_NAME ?? "Ops Supervisor"}
          logoUrl={process.env.NEXT_PUBLIC_AGENT_LOGO_URL || undefined}
          conversationStarters={{
            variant: "short",
            options: [
              { displayText: "System status", prompt: "Give me a system status summary." },
              { displayText: "Backtest ideas", prompt: "Suggest a backtest run for today's market." },
              { displayText: "Risk check", prompt: "What should I review before approving trades?" },
            ],
          }}
          welcomeMessage={{
            title: "Agentic Control",
            description:
              "This assistant coordinates monitoring, strategy experiments, and execution gating.",
          }}
        />
      </div>
    </ThemeProvider>
  );
}
