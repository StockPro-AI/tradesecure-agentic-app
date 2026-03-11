"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "api_keys_v1";
const PROVIDERS = ["OpenAI", "Ollama", "Anthropic", "Custom"];

const maskKey = (value) => {
  if (!value) return "-";
  const tail = value.slice(-4);
  return `${"*".repeat(Math.max(8, value.length - 4))}${tail}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("de-DE");
  } catch {
    return value;
  }
};

const normalizeKeys = (input) => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      provider: entry.provider,
      key: entry.key,
      createdAt: entry.createdAt,
      baseUrl: entry.baseUrl ?? "",
    }))
    .filter((entry) => entry.id && entry.name && entry.provider);
};

const defaultTestTargets = {
  OpenAI: "https://api.openai.com/v1/models",
  Anthropic: "https://api.anthropic.com/v1/models",
  Ollama: "http://localhost:11434/api/tags",
};

export default function ApiManager() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return normalizeKeys(parsed);
    } catch {
      return [];
    }
  });
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingProvider, setEditingProvider] = useState(PROVIDERS[0]);
  const [editingKey, setEditingKey] = useState("");
  const [editingBaseUrl, setEditingBaseUrl] = useState("");
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [testId, setTestId] = useState("");
  const [testStatus, setTestStatus] = useState({ state: "idle", message: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const providerOptions = useMemo(
    () => PROVIDERS.map((value) => ({ value, label: value })),
    []
  );

  const resetForm = () => {
    setName("");
    setProvider(PROVIDERS[0]);
    setApiKey("");
    setBaseUrl("");
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
    setEditingProvider(entry.provider);
    setEditingKey("");
    setEditingBaseUrl(entry.baseUrl ?? "");
  };

  const stopEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingProvider(PROVIDERS[0]);
    setEditingKey("");
    setEditingBaseUrl("");
  };

  const updateItem = (id, updates) => {
    setItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
    );
  };

  const handleAdd = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (provider !== "Ollama" && !apiKey.trim()) return;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `key_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const entry = {
      id,
      name: trimmedName,
      provider,
      key: apiKey.trim(),
      createdAt: new Date().toISOString(),
      baseUrl: baseUrl.trim(),
    };
    setItems((prev) => [entry, ...prev]);
    setTestId(entry.id);
    resetForm();
  };

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((entry) => entry.id !== id));
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (testId === id) {
      setTestId("");
      setTestStatus({ state: "idle", message: "" });
    }
  };

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setTestStatus({ state: "ok", message: "Schlüssel kopiert." });
    } catch {
      setTestStatus({ state: "error", message: "Kopieren fehlgeschlagen." });
    }
  };

  const toggleReveal = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runTest = async () => {
    const entry = items.find((item) => item.id === testId);
    if (!entry) {
      setTestStatus({ state: "error", message: "Bitte zuerst einen Schlüssel wählen." });
      return;
    }

    const target =
      entry.provider === "Custom"
        ? entry.baseUrl
        : defaultTestTargets[entry.provider];

    if (!target) {
      setTestStatus({
        state: "error",
        message: "Für diesen Anbieter ist keine Test-URL hinterlegt.",
      });
      return;
    }

    if (!entry.key && entry.provider !== "Ollama") {
      setTestStatus({ state: "error", message: "Kein Schlüssel vorhanden." });
      return;
    }

    setTestStatus({ state: "running", message: "Teste Verbindung..." });

    try {
      const headers = {};
      if (entry.provider === "OpenAI") {
        headers.Authorization = `Bearer ${entry.key}`;
      }
      if (entry.provider === "Anthropic") {
        headers["x-api-key"] = entry.key;
        headers["anthropic-version"] = "2023-06-01";
      }

      const response = await fetch(target, { method: "GET", headers });
      if (!response.ok) {
        setTestStatus({
          state: "error",
          message: `Test fehlgeschlagen (${response.status}).`,
        });
        return;
      }

      setTestStatus({ state: "ok", message: "Verbindung erfolgreich." });
    } catch (error) {
      setTestStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Test fehlgeschlagen.",
      });
    }
  };

  const testBadge =
    testStatus.state === "ok"
      ? "bg-emerald-600 text-white"
      : testStatus.state === "error"
      ? "bg-rose-600 text-white"
      : "bg-white/10 text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          API-Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 text-foreground shadow-[0_0_40px_rgba(14,116,144,0.35)] backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            API-Manager · Anbieter & Schlüssel
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_20px_rgba(14,116,144,0.15)]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-200">
              API-Anbieter
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Wähle deinen Anbieter und verwalte Schlüssel zentral.
            </p>
            <div className="mt-4 grid gap-3">
              {providerOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/5 via-white/0 to-transparent px-4 py-3 text-sm ${
                    provider === option.value ? "ring-1 ring-emerald-400/60" : ""
                  }`}
                  onClick={() => setProvider(option.value)}
                >
                  <span className="font-medium">{option.label}</span>
                  <Badge className="bg-white/10 text-xs">{option.value}</Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_20px_rgba(234,179,8,0.18)]">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
              Gespeicherte Schlüssel
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Gespeicherte API-Schlüssel werden lokal im Browser gehalten.
            </p>
            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-muted-foreground">
                  Noch keine Schlüssel gespeichert.
                </div>
              ) : (
                items.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isRevealed = revealedIds.has(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{entry.name}</span>
                            <Badge className="bg-emerald-500/20 text-emerald-200">
                              {entry.provider}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Erstellt: {formatDate(entry.createdAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleCopy(entry.key)}>
                            Kopieren
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleReveal(entry.id)}
                          >
                            {isRevealed ? "Verbergen" : "Anzeigen"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(entry)}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(entry.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-emerald-100">
                        {isRevealed ? entry.key || "-" : maskKey(entry.key)}
                      </div>

                      {entry.baseUrl ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Basis-URL: {entry.baseUrl}
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div className="mt-4 grid gap-3">
                          <Input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            placeholder="Name"
                          />
                          <select
                            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                            value={editingProvider}
                            onChange={(event) => setEditingProvider(event.target.value)}
                          >
                            {providerOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {editingProvider === "Custom" || editingProvider === "Ollama" ? (
                            <Input
                              value={editingBaseUrl}
                              onChange={(event) => setEditingBaseUrl(event.target.value)}
                              placeholder="Basis-URL (optional)"
                            />
                          ) : null}
                          <Input
                            value={editingKey}
                            onChange={(event) => setEditingKey(event.target.value)}
                            placeholder="Neuer Schlüssel (leer lassen = unverändert)"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!editingName.trim()) return;
                                updateItem(entry.id, {
                                  name: editingName.trim(),
                                  provider: editingProvider,
                                  key: editingKey.trim() ? editingKey.trim() : entry.key,
                                  baseUrl: editingBaseUrl.trim(),
                                });
                                stopEdit();
                              }}
                            >
                              Speichern
                            </Button>
                            <Button size="sm" variant="outline" onClick={stopEdit}>
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_20px_rgba(14,116,144,0.12)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-200">
            Neuen Schlüssel hinzufügen
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1.2fr]">
            <Input
              placeholder="Name (z. B. Trading Ops)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              type="password"
              placeholder={provider === "Ollama" ? "Optionaler Schlüssel" : "API-Schlüssel"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          {provider === "Custom" || provider === "Ollama" ? (
            <div className="mt-3">
              <Input
                placeholder="Basis-URL (optional)"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handleAdd}>Schlüssel hinzufügen</Button>
            <Button variant="outline" onClick={resetForm}>
              Zurücksetzen
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Schlüssel werden ausschließlich lokal gespeichert. Für Ollama lokal ist kein
            Schlüssel nötig.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_20px_rgba(234,179,8,0.12)]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
            Verbindungstest
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_auto_auto]">
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={testId}
              onChange={(event) => setTestId(event.target.value)}
            >
              <option value="">Schlüssel auswählen</option>
              {items.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.provider}
                </option>
              ))}
            </select>
            <Button onClick={runTest}>Schlüssel testen</Button>
            <Badge className={testBadge}>
              {testStatus.state === "idle" ? "Bereit" : testStatus.message}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Hinweis: Browser-Tests können durch CORS blockiert werden. In dem Fall bitte
            providerseitig prüfen.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
