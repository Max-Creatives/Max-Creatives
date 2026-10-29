"use client";
import { useState } from "react";
import { ArrowRight, Clapperboard, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function LoginForm() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#102e28] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-bold">
          <span className="rounded-xl bg-emerald-400 p-2 text-emerald-950">
            <Clapperboard size={25} />
          </span>
          max<span className="font-normal text-emerald-200">outreach</span>
          <span className="rounded border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-300">
            AI
          </span>
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="mb-6 flex items-center gap-2 text-xs text-emerald-300">
            <Sparkles size={16} /> BUILT FOR CREATIVE AMBITION
          </div>
          <h1 className="text-5xl font-semibold leading-[1.15] tracking-tight">
            Make the connection.
            <br />
            <span className="text-emerald-300">Create the opportunity.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-emerald-100/65">
            Your workspace for finding businesses, organizing leads, and turning
            creative ideas into client conversations.
          </p>
        </div>
        <p className="text-xs text-emerald-100/40">
          Thoughtful outreach. Extraordinary possibilities.
        </p>
        <div className="absolute -right-36 bottom-24 size-[500px] rounded-full border-[80px] border-emerald-200/5" />
      </section>
      <section className="flex items-center justify-center p-6 sm:p-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 font-bold lg:hidden">
            <Clapperboard className="text-emerald-700" /> Max Outreach AI
          </div>
          <span className="eyebrow text-emerald-700">
            YOUR CREATIVE WORKSPACE
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Welcome back, Max.
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Sign in to build your next client relationship.
          </p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block text-xs font-medium">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                className="mt-2 w-full"
                placeholder="you@yourbusiness.com"
              />
            </label>
            <label className="block text-xs font-medium">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                className="mt-2 w-full"
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
              >
                {error}
              </p>
            )}
            <Button className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowRight size={16} />
            </Button>
          </form>
          <div className="mt-8 flex gap-2 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-400">
            <ShieldCheck size={18} className="shrink-0" />
            <p>
              Private, invite-only workspace. Ask your administrator for account
              access.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
