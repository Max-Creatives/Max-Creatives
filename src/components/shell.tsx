"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ScanSearch,
  MailSearch,
  Sparkles,
  Send,
  Inbox,
  HeartHandshake,
  ChartNoAxesCombined,
  Settings,
  Clapperboard,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
const nav = [
  { href: "/", name: "Overview", icon: LayoutDashboard },
  { href: "/leads", name: "Leads", icon: Users },
  { href: "/research", name: "Research Agent", icon: ScanSearch, later: true },
  {
    href: "/discovery",
    name: "Email Discovery",
    icon: MailSearch,
    later: true,
  },
  { href: "/pitches", name: "AI Pitch Generator", icon: Sparkles, later: true },
  { href: "/campaigns", name: "Campaigns", icon: Send, later: true },
  { href: "/inbox", name: "Gmail Inbox", icon: Inbox, later: true },
  {
    href: "/clients",
    name: "Interested Clients",
    icon: HeartHandshake,
    later: true,
  },
  { href: "/analytics", name: "Analytics", icon: ChartNoAxesCombined },
];
export function Shell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const title =
    path === "/settings"
      ? "Settings"
      : nav.find((n) => n.href === path)?.name || "Workspace";
  async function logout() {
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw new Error();
      router.push("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please retry.");
    }
  }
  return (
    <div className="min-h-screen">
      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[238px] flex-col overflow-y-auto border-r border-[#e6eae8] bg-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          className="flex h-[82px] shrink-0 items-center gap-2 px-6 text-[19px] font-bold tracking-tight"
        >
          <span className="mr-1 rounded-lg bg-[#0a7655] p-1.5 text-white">
            <Clapperboard size={21} />
          </span>
          max<span className="-ml-1 font-normal text-zinc-500">outreach</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] tracking-normal text-emerald-700">
            AI
          </span>
        </Link>
        <div className="mx-4 mb-7 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="flex size-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-semibold">
            M<span className="text-emerald-600">.</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold">Max’s workspace</p>
            <p className="mt-1 text-[10px] text-zinc-400">
              AI video & creative studio
            </p>
          </div>
          <ChevronDown size={13} className="text-zinc-400" />
        </div>
        <div className="px-6 pb-3 eyebrow text-zinc-400">Workspace</div>
        <nav aria-label="Main navigation" className="space-y-1 px-3">
          {nav.map((n, i) => (
            <Link
              key={n.href}
              onClick={() => setOpen(false)}
              href={n.href}
              aria-current={path === n.href ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-xs transition-colors",
                path === n.href
                  ? "bg-[#eaf5ef] font-semibold text-[#0b7754]"
                  : "text-[#6d7781] hover:bg-zinc-50",
                i === 5 && "mt-4",
              )}
            >
              <n.icon size={17} strokeWidth={1.7} />
              <span>{n.name}</span>
              {n.later && (
                <span className="ml-auto text-[9px] text-zinc-400">Soon</span>
              )}
              {path === n.href && (
                <span className="absolute -left-3 h-5 w-[3px] rounded-r bg-emerald-600" />
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <div className="grain mb-4 rounded-xl border border-emerald-100 bg-[#f2faf5] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <ShieldCheck size={16} />
              You’re in control
            </div>
            <p className="text-[11px] leading-[18px] text-emerald-900/60">
              Research first. Human review.
              <br />
              Every connection, considered.
            </p>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-800"
            >
              Workspace settings
              <ArrowUpRight size={12} />
            </Link>
          </div>
          <Link
            onClick={() => setOpen(false)}
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg p-3 text-xs text-zinc-500",
              path === "/settings" && "bg-emerald-50 text-emerald-700",
            )}
          >
            <Settings size={17} />
            Settings
          </Link>
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eee9df] text-xs font-semibold text-[#827054]">
              M
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">
                Max{" "}
                <span className="ml-1 rounded bg-zinc-100 px-1 text-[8px] font-normal text-zinc-500">
                  OWNER
                </span>
              </p>
              <p
                title={email}
                className="mt-1 truncate text-[10px] text-zinc-400"
              >
                {email}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={logout}
              className="p-1 text-zinc-400 hover:text-red-600"
            >
              <LogOut size={15} />
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className="lg:pl-[238px]">
        <header className="flex h-[68px] items-center justify-between border-b border-zinc-200/70 bg-white px-5 sm:px-9">
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setOpen(!open)}
              aria-label="Open navigation"
              className="lg:hidden"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="hidden text-zinc-400 sm:inline">Workspace</span>
            <ChevronRight size={12} className="hidden text-zinc-300 sm:block" />
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-500">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Phase 1 · Lead workspace
            </span>
            <div className="hidden h-5 w-px bg-zinc-200 sm:block" />
            <span className="hidden text-xs text-zinc-500 sm:block">
              Let’s create opportunities.
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1520px] px-5 py-7 sm:px-9 sm:py-9 animate-enter">
          {children}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/70 pt-5 text-[10px] text-zinc-400">
            <span>
              © {new Date().getFullYear()} Max Outreach AI. Built for your next
              big idea.
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} />
              Your data stays in your workspace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
