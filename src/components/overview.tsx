import Link from "next/link";
import {
  Users,
  Building2,
  Mail,
  ScanSearch,
  ArrowUpRight,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  Check,
  Sparkles,
  CircleCheck,
  ChevronRight,
  ShieldCheck,
  Clock3,
  Send,
  MessageSquare,
  HeartHandshake,
  DollarSign,
  Film,
  Lightbulb,
} from "lucide-react";
import { ImportDialog } from "./import-dialog";
import type { workspaceStats } from "@/lib/queries";
import { Button } from "./ui/button";
type Stats = Awaited<ReturnType<typeof workspaceStats>>;
export function Overview({ stats }: { stats: Stats }) {
  const cards = [
    {
      name: "Total leads",
      value: stats.total,
      hint: "Your next opportunities",
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      href: "/leads",
    },
    {
      name: "Verified businesses",
      value: stats.verified,
      hint: "Evidence-backed matches",
      icon: Building2,
      color: "bg-emerald-50 text-emerald-600",
      href: "/research",
    },
    {
      name: "Email addresses",
      value: stats.emails,
      hint: "Imported · not yet verified",
      icon: Mail,
      color: "bg-violet-50 text-violet-600",
      href: "/leads?status=has_email",
    },
    {
      name: "Unresolved contacts",
      value: stats.unresolved,
      hint: "Waiting to be researched",
      icon: ScanSearch,
      color: "bg-amber-50 text-amber-600",
      href: "/leads?status=unresolved",
    },
  ];
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="mb-1">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="h-1 w-5 rounded-full bg-emerald-600" />
            YOUR OPPORTUNITY HUB
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Good things start with a connection.
          </h1>
          <p className="mt-2.5 text-xs leading-5 text-zinc-500">
            From the first lead to the next big project. Let’s build your
            pipeline.
          </p>
        </div>
        <div className="flex gap-2 pt-3">
          <Button variant="outline" asChild>
            <Link href="/leads">
              <Users size={14} />
              View all leads
            </Link>
          </Button>
          <ImportDialog />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            href={c.href}
            key={c.name}
            className="panel p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                {c.name}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-lg ${c.color}`}
              >
                <c.icon size={16} />
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[32px] font-semibold leading-none tracking-tight">
                {c.value.toLocaleString()}
              </span>
              <ArrowUpRight size={15} className="text-zinc-300" />
            </div>
            <p className="mt-3 text-[10px] text-zinc-400">{c.hint}</p>
          </Link>
        ))}
      </div>
      <section className="relative mt-6 overflow-hidden rounded-xl border border-[#cde4d6] bg-[#ecf6ef] p-6 sm:p-7">
        <div className="absolute -right-8 -top-10 size-64 rounded-full border-[35px] border-emerald-600/[.035]" />
        <div className="relative flex items-center gap-2 text-[10px] font-semibold tracking-[.1em] text-emerald-800">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-700 text-white">
            <Sparkles size={11} />
          </span>
          SMALL STEPS. BIG POSSIBILITIES.
        </div>
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#1b4431]">
              Your next great client is out there.
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#64806b]">
              Start with your contacts. Build a thoughtful, well-organized lead
              list.
            </p>
          </div>
          <Link
            href="/leads"
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-medium text-emerald-800 shadow-xs"
          >
            Let’s get started
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="relative mt-6 grid gap-5 border-t border-emerald-900/10 pt-5 sm:grid-cols-3">
          {[
            {
              label: "Import your contacts",
              sub: "Bring your existing leads together",
              done: stats.total > 0,
            },
            {
              label: "Review the details",
              sub: "Keep your information accurate",
              done: false,
            },
            {
              label: "Prepare for outreach",
              sub: "Set your sender identity & preferences",
              done: false,
            },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${step.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-900/15 bg-white/50 text-emerald-800"}`}
              >
                {step.done ? <Check size={13} /> : `0${i + 1}`}
              </div>
              <div>
                <p className="text-xs font-medium text-[#335c43]">
                  {step.label}
                </p>
                <p className="mt-1 text-[10px] text-[#7e9484]">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="text-sm font-semibold">Your outreach pipeline</h2>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Every stage of your next client relationship
              </p>
            </div>
            <span className="rounded-md border border-zinc-200 px-2 py-1 text-[9px] text-zinc-500">
              ALL TIME
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 px-5 pb-5">
            {[
              {
                title: "Imported",
                value: stats.total,
                icon: Upload,
                color: "bg-blue-50 text-blue-600",
              },
              {
                title: "Verified",
                value: stats.verified,
                icon: CircleCheck,
                color: "bg-emerald-50 text-emerald-600",
              },
              {
                title: "Contacted",
                value: 0,
                icon: Send,
                color: "bg-violet-50 text-violet-600",
              },
              {
                title: "Interested",
                value: 0,
                icon: HeartHandshake,
                color: "bg-amber-50 text-amber-600",
              },
            ].map((p, i) => (
              <div
                key={p.title}
                className="relative rounded-lg bg-[#fafbfc] p-3"
              >
                <div
                  className={`mb-4 flex size-7 items-center justify-center rounded-lg ${p.color}`}
                >
                  <p.icon size={14} />
                </div>
                <p className="text-2xl font-semibold">{p.value}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{p.title}</p>
                {i < 3 && (
                  <ChevronRight
                    size={12}
                    className="absolute -right-2 top-1/2 z-10 rounded-full bg-white text-zinc-400"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-zinc-100 px-5 py-4 sm:grid-cols-4">
            {[
              ["Drafts generated", 0],
              ["Emails approved", 0],
              ["Replies received", 0],
              ["Storyboards requested", 0],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] text-zinc-400">{k}</p>
                <p className="mt-1.5 text-sm font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-b-xl border-t border-zinc-100 bg-zinc-50/50 px-5 py-3 text-[10px] leading-4 text-zinc-400">
            <ShieldCheck size={13} className="shrink-0" />
            Research, drafting, and sending arrive in later phases. No outreach
            has been sent.
          </div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lead readiness</h2>
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live data
            </span>
          </div>
          <div className="flex items-center gap-7 py-7">
            <div
              className="relative flex size-32 shrink-0 items-center justify-center rounded-full"
              style={{
                background: stats.total
                  ? `conic-gradient(#059669 0deg ${(stats.verified / stats.total) * 360}deg, #a5b4fc ${(stats.verified / stats.total) * 360}deg ${((stats.verified + stats.review) / stats.total) * 360}deg, #fbbf24 ${((stats.verified + stats.review) / stats.total) * 360}deg 360deg)`
                  : "#edf1f0",
              }}
            >
              <div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[25px] font-semibold">{stats.total}</span>
                <span className="mt-1 text-[9px] text-zinc-400">
                  TOTAL LEADS
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              {[
                ["Verified", stats.verified, "bg-emerald-500"],
                ["Needs review", stats.review, "bg-indigo-300"],
                ["Unresolved", stats.unresolved, "bg-amber-400"],
              ].map(([label, count, color]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className={`size-1.5 rounded-full ${color}`} />
                  <span className="text-zinc-500">{label}</span>
                  <span className="ml-auto font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/leads?status=manual_review"
            className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-3 text-[11px] text-zinc-500"
          >
            <span>
              {stats.review
                ? `${stats.review} leads need your attention`
                : "A clear view of every opportunity"}
            </span>
            <ArrowRight size={13} />
          </Link>
        </section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="text-sm font-semibold">Recent imports</h2>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                The latest additions to your creative pipeline
              </p>
            </div>
            <Link
              href="/leads"
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-700"
            >
              View leads
              <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentImports.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>File name</th>
                    <th>Imported</th>
                    <th>Skipped / invalid</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentImports.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet
                            size={15}
                            className="shrink-0 text-emerald-700"
                          />
                          <span className="max-w-48 truncate">
                            {batch.fileName}
                          </span>
                        </div>
                      </td>
                      <td>{batch.imported}</td>
                      <td className="text-zinc-400">
                        {batch.skipped} / {batch.errors}
                      </td>
                      <td className="whitespace-nowrap text-zinc-400">
                        {batch.createdAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 pb-7 pt-3 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50">
                <FileSpreadsheet
                  size={23}
                  strokeWidth={1.4}
                  className="text-zinc-400"
                />
              </div>
              <h3 className="text-xs font-medium">
                A fresh start for your pipeline
              </h3>
              <p className="mb-4 mt-2 max-w-xs text-[11px] leading-5 text-zinc-400">
                Upload your first CSV. We’ll normalize phone numbers and catch
                duplicates before you import.
              </p>
              <ImportDialog compact label="Import your first leads" />
            </div>
          )}
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-semibold">
            Creative potential, at a glance
          </h2>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            From a promising conversation to a paid project
          </p>
          <div className="my-5 grid grid-cols-2 divide-x divide-zinc-100">
            <div>
              <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <HeartHandshake size={16} />
              </span>
              <p className="text-2xl font-semibold">0</p>
              <p className="mt-1 text-[10px] text-zinc-400">Deals closed</p>
            </div>
            <div className="pl-5">
              <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <DollarSign size={16} />
              </span>
              <p className="text-2xl font-semibold">$0</p>
              <p className="mt-1 text-[10px] text-zinc-400">
                Estimated revenue
              </p>
            </div>
          </div>
          <div className="flex gap-2 rounded-lg bg-[#f8f9fc] p-3">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[10px] leading-[18px] text-zinc-500">
              Your sweet spot:{" "}
              <strong className="font-medium text-zinc-700">$700–$1,500</strong>{" "}
              per AI video project. A few right-fit clients can go a long way.
            </p>
          </div>
        </section>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-300/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-white p-2 text-emerald-700">
            <Film size={19} />
          </span>
          <div>
            <p className="text-xs font-medium">Built around what you create.</p>
            <p className="mt-1 text-[10px] text-zinc-400">
              AI commercials · UGC · Cinematic ads · Product videos · 3D
              animation
            </p>
          </div>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-1 text-[11px] text-zinc-500"
        >
          Personalize your workspace
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </>
  );
}
