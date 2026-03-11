"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
