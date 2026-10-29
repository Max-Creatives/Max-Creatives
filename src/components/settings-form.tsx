"use client";
import { useState } from "react";
import {
  Save,
  ShieldCheck,
  Mail,
  BrainCircuit,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./ui/button";
type Settings = {
  senderName: string;
  postalAddress: string;
  mode: string;
  monthlyBudget: number;
};
export function SettingsForm({
  settings,
  suppressed,
  searchConfigured = false,
}: {
  settings: Settings;
  suppressed: number;
  searchConfigured?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(f),
          monthlyBudget: Number(f.get("monthlyBudget")),
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setError(false);
      setMessage("Workspace preferences saved.");
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow text-emerald-700">MAKE IT YOURS</span>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        Workspace settings
      </h1>
      <p className="mb-7 mt-2 text-xs text-zinc-500">
        The foundations for thoughtful, responsible outreach.
      </p>
      <form
        onSubmit={save}
        className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]"
      >
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Mail size={17} className="text-emerald-700" />
              Sender identity
            </h2>
            <p className="mb-6 mt-2 text-xs leading-5 text-zinc-400">
              Prepare accurate sender details before email outreach is enabled.
            </p>
            <label className="block text-xs font-medium">
              Sender name
              <input
                className="mb-5 mt-2 w-full"
                name="senderName"
                defaultValue={settings.senderName}
                required
                maxLength={100}
              />
            </label>
            <label className="block text-xs font-medium">
              Physical postal address
              <textarea
                className="mt-2 w-full"
                name="postalAddress"
                rows={3}
                defaultValue={settings.postalAddress}
                maxLength={1000}
                placeholder="Your valid business mailing address"
              />
            </label>
            <p className="mt-2 text-[10px] leading-5 text-zinc-400">
              Required before commercial email sending. A saved address is
              user-supplied; this app does not verify postal deliverability.
            </p>
          </section>
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit size={17} className="text-emerald-700" />
              Operating preferences
            </h2>
            <label className="mt-5 block text-xs font-medium">
              Workspace mode
              <select
                className="mt-2 w-full"
                name="mode"
                defaultValue={settings.mode}
              >
                <option value="research_only">Research only</option>
                <option value="draft_only">Draft only</option>
              </select>
            </label>
            <p className="mt-2 text-[10px] leading-5 text-zinc-400">
              Research is available. AI drafting is a later phase; no messages
              are sent.
            </p>
            <label className="mt-5 block text-xs font-medium">
              Monthly AI budget (USD)
              <input
                className="mt-2 w-full"
                name="monthlyBudget"
                type="number"
                min={0}
                max={10000}
                step={1}
                required
                defaultValue={settings.monthlyBudget}
              />
            </label>
            <p className="mt-2 text-[10px] leading-5 text-zinc-400">
              A planning preference. Budget enforcement and usage metering
              arrive with AI integration.
            </p>
          </section>
          {message && (
            <p
              role={error ? "alert" : "status"}
              className={`rounded-lg p-3 text-xs ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
            >
              {message}
            </p>
          )}
          <Button disabled={busy} type="submit">
            <Save size={14} />
            {busy ? "Saving…" : "Save preferences"}
          </Button>
        </div>
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={17} className="text-emerald-700" />
              Contact protection
            </h2>
            <p className="mt-5 text-3xl font-semibold">{suppressed}</p>
            <p className="mt-1 text-xs text-zinc-400">
              Suppressed email addresses
            </p>
            <p className="mt-5 border-t border-zinc-100 pt-4 text-xs leading-6 text-zinc-500">
              Mark a lead “Do not contact” to exclude it and preserve its email
              on your suppression list. No sending functionality is enabled.
            </p>
          </section>
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole size={17} className="text-emerald-700" />
              Connected services
            </h2>
            {[
              ["PostgreSQL", "Connected · application data", true],
              ["Gmail", "Phase 4 · not connected", false],
              ["AI provider", "Phase 3 · not configured", false],
              [
                "Business search",
                searchConfigured
                  ? "Key configured · verify with a research batch"
                  : "Add a Brave Search API key in Render",
                searchConfigured,
              ],
            ].map(([name, description, connected]) => (
              <div
                key={String(name)}
                className="flex items-center justify-between border-b border-zinc-100 py-4 last:border-0"
              >
                <div>
                  <p className="text-xs font-medium">{name}</p>
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {description}
                  </p>
                </div>
                {connected ? (
                  <CheckCircle2 size={15} className="text-emerald-600" />
                ) : (
                  <span className="size-1.5 rounded-full bg-zinc-300" />
                )}
              </div>
            ))}
            <p className="mt-2 text-[10px] leading-5 text-zinc-400">
              Provider credentials stay on the server. There is no API key entry
              in the browser.
            </p>
          </section>
        </div>
      </form>
    </>
  );
}
