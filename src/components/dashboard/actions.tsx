"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActionState = {
  pending: boolean;
};

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = async (fn: () => Promise<void>) => {
    startTransition(() => {
      fn()
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          router.refresh();
        });
    });
  };

  return { pending, run } satisfies ActionState & { run: (fn: () => Promise<void>) => void };
}

export function SnapshotButton() {
  const { pending, run } = useAction();

  return (
    <Button
      disabled={pending}
      variant="secondary"
      onClick={() =>
        run(async () => {
          await fetch("/api/market/snapshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "manual", rows: [] }),
          });
        })
      }
    >
      {pending ? "Capturing..." : "Capture Snapshot"}
    </Button>
  );
}

export function CreateStrategyForm() {
  const { pending, run } = useAction();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Strategy name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Textarea
        placeholder="Hypothesis summary"
        value={hypothesis}
        onChange={(event) => setHypothesis(event.target.value)}
        rows={4}
      />
      <Button
        disabled={pending || !name.trim() || !hypothesis.trim()}
        onClick={() =>
          run(async () => {
            await fetch("/api/strategy/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, hypothesis }),
            });
            setName("");
            setHypothesis("");
          })
        }
      >
        {pending ? "Creating..." : "Create Strategy"}
      </Button>
    </div>
  );
}

export function RunBacktestButton({ strategyId }: { strategyId: string }) {
  const { pending, run } = useAction();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        run(async () => {
          await fetch("/api/strategy/run-backtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ strategyId }),
          });
        })
      }
    >
      {pending ? "Running..." : "Run Backtest"}
    </Button>
  );
}

export function QueueTradeDialog() {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("10");
  const [side, setSide] = useState<"buy" | "sell">("buy");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Queue Trade</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Queue a Demo Trade</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Tabs value={side} onValueChange={(value) => setSide(value as "buy" | "sell")}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Symbol (e.g. SPY)"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
          />
          <Input
            placeholder="Quantity"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
          />
          <Button
            disabled={pending || !symbol.trim() || Number(qty) <= 0}
            onClick={() =>
              run(async () => {
                await fetch("/api/execution/submit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    symbol,
                    qty: Number(qty),
                    side,
                  }),
                });
                setOpen(false);
                setSymbol("");
              })
            }
          >
            {pending ? "Queuing..." : "Add to Queue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type AssistantSettingsSnapshot = {
  provider: string;
  model: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  mode: string;
};

export function SettingsDialog({
  initial,
  loginEnabled = false,
}: {
  initial: AssistantSettingsSnapshot;
  loginEnabled?: boolean;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "");
  const [mode, setMode] = useState(initial.mode);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Settings</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assistant & Model Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Provider</span>
            <Input
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="openai"
            />
          </div>
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Mode</span>
            <Tabs value={mode} onValueChange={(value) => setMode(value)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="mock">Mock</TabsTrigger>
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="live">Live</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Model</span>
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Base URL (optional)</span>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">API Key</span>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasApiKey ? "Stored (enter to replace)" : "sk-..."}
            />
            <span className="text-xs text-muted-foreground">
              Mode: {mode}
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {loginEnabled ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                })
              }
            >
              Sign out
            </Button>
          ) : null}
          {hasApiKey ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clearApiKey: true }),
                  });
                  setHasApiKey(false);
                  setApiKey("");
                })
              }
            >
              Clear Key
            </Button>
          ) : null}
          <Button
            disabled={pending}
            onClick={() =>
              run(async () => {
                await fetch("/api/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    provider,
                    model,
                    mode,
                    baseUrl,
                    apiKey,
                  }),
                });
                if (apiKey.trim()) {
                  setHasApiKey(true);
                  setApiKey("");
                }
                setOpen(false);
              })
            }
          >
            {pending ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApproveExecutionButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        run(async () => {
          await fetch("/api/execution/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
        })
      }
    >
      {pending ? "Approving..." : "Approve"}
    </Button>
  );
}

export function RejectExecutionButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        run(async () => {
          await fetch("/api/execution/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "rejected" }),
          });
        })
      }
    >
      {pending ? "Rejecting..." : "Reject"}
    </Button>
  );
}
