import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAssistantSettingsSafe, getAutomationStatus, getDashboardData } from "@/lib/store";
import {
  ApproveExecutionButton,
  CreateStrategyForm,
  QueueTradeDialog,
  RejectExecutionButton,
  RunBacktestButton,
  SettingsDialog,
  SnapshotButton,
} from "@/components/dashboard/actions";
import { AssistantChat } from "@/components/dashboard/assistant-chat";
import ApiManager from "@/components/ApiManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const formatNumber = (value?: number | null) =>
  typeof value === "number" ? value.toLocaleString("en-US") : "NA";
const formatPct = (value?: number | null) =>
  typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "NA";

const statusBadge = (status: string) => {
  const base = "uppercase tracking-wide";
  switch (status) {
    case "approved":
      return <Badge className={base}>Approved</Badge>;
    case "executed":
      return <Badge className={`${base} bg-emerald-600 text-white`}>Executed</Badge>;
    case "failed":
      return <Badge className={`${base} bg-rose-600 text-white`}>Failed</Badge>;
    case "rejected":
      return <Badge variant="outline" className={base}>Rejected</Badge>;
    default:
      return <Badge variant="secondary" className={base}>Pending</Badge>;
  }
};

export default function Home() {
  const dashboard = getDashboardData();
  const pendingApprovals = dashboard.queue.filter(
    (item) => item.status === "pending_human"
  ).length;
  const latestSnapshot = dashboard.market[0]?.captured_at ?? "No snapshot yet";
  const assistantSettings = getAssistantSettingsSafe();
  const loginEnabled = Boolean(process.env.DASHBOARD_PASSWORD);
  const automationStatus = getAutomationStatus();
  const assistantNeedsKey =
    assistantSettings.provider === "openai" ||
    assistantSettings.provider === "openrouter" ||
    (assistantSettings.provider === "ollama" &&
      Boolean(assistantSettings.baseUrl?.includes("ollama.com")));

  return (
    <div className="min-h-screen px-6 py-10 lg:px-10">
      <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3">
          <Badge className="w-fit bg-white/10 text-white ring-1 ring-white/20">
            Demo Control Room
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            TradeSecure Agentic Control
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            UI-only monitoring, research workflows, and human-in-the-loop execution for a
            demo environment. No external market data is used.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SnapshotButton />
          <QueueTradeDialog />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pending Approvals</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{pendingApprovals}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Strategies</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {dashboard.strategies.length}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Last Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-semibold">{latestSnapshot}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Market Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.market.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No UI snapshots yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dashboard.market.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.symbol}</TableCell>
                        <TableCell>{formatNumber(row.price)}</TableCell>
                        <TableCell>{formatPct(row.change_pct)}</TableCell>
                        <TableCell>{formatNumber(row.volume)}</TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">
                          {row.source}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strategy Factory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Capture a hypothesis, then run a mock backtest to evaluate the signal.
                </p>
                <CreateStrategyForm />
              </div>
              <div className="space-y-3">
                {dashboard.strategies.map((strategy) => (
                  <div
                    key={strategy.id}
                    className="glass-panel rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{strategy.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {strategy.hypothesis}
                        </p>
                      </div>
                      <RunBacktestButton strategyId={strategy.id} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {dashboard.queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No execution intents queued.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.symbol}</TableCell>
                      <TableCell className="uppercase">{item.side}</TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {item.status === "pending_human" ? (
                          <>
                            <ApproveExecutionButton id={item.id} />
                            <RejectExecutionButton id={item.id} />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Locked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backtest Runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.backtests.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No backtests yet. Run one from the Strategy Factory.
                </div>
              ) : (
                dashboard.backtests.map((run) => {
                  const metrics = JSON.parse(run.metrics_json);
                  return (
                    <div
                      key={run.id}
                      className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs uppercase text-muted-foreground">
                          Strategy {run.strategy_id.slice(0, 6)}
                        </span>
                        <span className="font-medium">Sharpe {metrics.sharpe}</span>
                      </div>
                      <div className="flex gap-4">
                        <span>Max DD {metrics.max_dd}</span>
                        <span>Win {metrics.win_rate}</span>
                        <span>Trades {metrics.total_trades}</span>
                      </div>
                      <Badge
                        className={
                          run.status === "pass"
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-500 text-white"
                        }
                      >
                        {run.status.toUpperCase()}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>TradeSecure-Login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Webtrader</span>
                <a
                  className="rounded-md bg-white/10 px-3 py-1 text-xs text-white ring-1 ring-white/20 transition hover:bg-white/20"
                  href="https://webtrader.tradesecure.io/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Login öffnen
                </a>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Automations-Session</span>
                <Badge variant={automationStatus.hasSession ? "secondary" : "outline"}>
                  {automationStatus.hasSession ? "Erfasst" : "Fehlt"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Um lokal eine Session zu erfassen, führe{" "}
                <span className="font-medium">npm run automation:login</span> aus.
              </p>
              <ApiManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>Provider</span>
                  <span className="text-xs font-semibold uppercase">
                    {assistantSettings.provider}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Model</span>
                  <span className="text-xs">{assistantSettings.model || "Not set"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>Mode</span>
                  <span className="text-xs uppercase">{assistantSettings.mode}</span>
                </div>
              </div>
              <SettingsDialog initial={assistantSettings} loginEnabled={loginEnabled} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Market Watcher</span>
                <Badge variant="secondary">Running</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Strategy Factory</span>
                <Badge variant="outline">Idle</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Execution Agent</span>
                <Badge variant="secondary">Awaiting Approval</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span>Risk Guardian</span>
                <Badge className="bg-black text-white">On Watch</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assistant Console</CardTitle>
            </CardHeader>
            <CardContent>
              <AssistantChat />
              {!assistantSettings.hasApiKey &&
              assistantNeedsKey &&
              assistantSettings.mode !== "mock" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Configure an API key in Settings to enable live model responses.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Stream</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {dashboard.events.length === 0 ? (
                <div>No events yet.</div>
              ) : (
                dashboard.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-foreground">{event.message}</p>
                      <p>{event.created_at}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
