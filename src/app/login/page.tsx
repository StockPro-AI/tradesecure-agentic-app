"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error ?? "Login failed.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setPending(false);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8f8f2,_#e5e7f0_55%,_#d2d6ee)] px-6 py-16">
      <div className="mx-auto max-w-md">
        <Card className="bg-white/90">
          <CardHeader>
            <CardTitle>TradeSecure Control Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter dashboard password"
                />
              </div>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
              <Button type="submit" disabled={pending || !password.trim()}>
                {pending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-xs text-muted-foreground">
          Login is only enforced when `DASHBOARD_PASSWORD` is set.
        </p>
      </div>
    </div>
  );
}
