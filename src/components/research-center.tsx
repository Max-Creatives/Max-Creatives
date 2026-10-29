"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScanSearch,
  Play,
  Pause,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  Mail,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  X,
  CircleHelp,
} from "lucide-react";
import { Button } from "./ui/button";
import { candidateEvidence } from "@/lib/research/evidence";
type LeadItem = {
  id: string;
  phone: string;
  businessName: string | null;
  website: string | null;
  email: string | null;
};
type Candidate = {
  id: string;
  businessName: string | null;
  website: string;
  confidence: number;
  phoneMatched: boolean;
  evidence: unknown;
  decision: string | null;
};
type Job = {
  id: string;
  status: string;
  attempts: number;
  error: string | null;
  lead: LeadItem;
  candidates: Candidate[];
  logs: { id: string; stage: string; message: string; createdAt: string }[];
};
type Batch = { id: string; status: string; createdAt: string; jobs: Job[] };
type ResearchData = {
  config: {
    searchConfigured: boolean;
    limit: number;
    used: number;
    month: string;
  };
  batches: Batch[];
  leads: LeadItem[];
  count: number;
  page: number;
  pages: number;
  historyPage: number;
  historyPages: number;
  discovered: {
    id: string;
    businessName: string | null;
    email: string | null;
    phone: string;
    sourceUrl: string | null;
    discoveredAt: string | null;
  }[];
};
export function ResearchCenter({ discovery = false }: { discovery?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<ResearchData | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [activeId, setActiveId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [acknowledge, setAcknowledge] = useState(false),
    [auto, setAuto] = useState(true),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1);
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/research?q=${encodeURIComponent(q)}&page=${page}&historyPage=${historyPage}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    setActiveId((current) =>
      result.batches.some((b: Batch) => b.id === current)
        ? current
        : result.batches[0]?.id || "",
    );
  }, [q, page, historyPage]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const active = data?.batches.find((b) => b.id === activeId);
  useEffect(() => {
    if (active?.status !== "running") return;
    const timer = setInterval(() => {
      load().catch((e) => setError(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [active?.status, load]);
  useEffect(() => {
    if (!auto || !activeId || active?.status !== "running") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function step() {
      try {
        const response = await fetch("/api/research/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: activeId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!stopped) {
          await load();
          if (!stopped) timer = setTimeout(step, 3000);
        }
      } catch (e) {
        if (!stopped) {
          setError(
            e instanceof Error
              ? e.message
              : "Processing was interrupted. Resume this batch to continue.",
          );
          setAuto(false);
        }
      }
    }
    void step();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [activeId, active?.status, auto, load]);
  async function action(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActiveId(result.batch.id);
      const created = (body as { action?: string }).action === "create";
      if (created) setHistoryPage(1);
      setAuto(true);
      setSelected([]);
      if (!created || historyPage === 1) await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update research.");
    } finally {
      setBusy(false);
    }
  }
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((v) => v !== id)
        : current.length < 25
          ? [...current, id]
          : current,
    );
  }
  const progress =
    active?.jobs.filter((j) =>
      ["completed", "failed", "blocked"].includes(j.status),
    ).length || 0;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow text-emerald-700">
            EVIDENCE BEFORE OUTREACH
          </span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
            {discovery ? "Find the right inbox." : "Get to know the business."}
          </h1>
          <p className="mt-2 text-xs leading-6 text-zinc-500">
            Research public business pages. Check the phone match. Review every
            email before saving.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-100 bg-red-50 p-4 text-xs leading-6 text-red-700"
        >
          {error}
        </div>
      )}
      {!data ? (
        <div className="panel flex items-center gap-3 p-10 text-zinc-500">
          <LoaderCircle size={18} className="animate-spin" />
          Loading your research workspace…
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              [
                "Search provider",
                data.config.searchConfigured ? "Configured" : "Key needed",
              ],
              [
                "Search requests this month",
                `${data.config.used} / ${data.config.limit}`,
              ],
              ["Confirmed emails shown", String(data.discovered.length)],
            ].map(([name, value]) => (
              <div key={name} className="panel p-5">
                <p className="text-xs text-zinc-400">{name}</p>
                <p className="mt-3 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {!data.config.searchConfigured && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-xs leading-6 text-amber-900">
              <strong>Phone-only lookup needs a search key.</strong> Open{" "}
              <a
                href="https://api-dashboard.search.brave.com/"
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                Brave Search API
              </a>
              , review its pricing, then add{" "}
              <strong>BRAVE_SEARCH_API_KEY</strong> in Render → max-outreach-ai
              → Environment. Supplied HTTPS business websites can be checked
              without a search key. Never put keys in your notes or CSV.
            </div>
          )}
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs leading-6 text-blue-900">
            <ShieldAlert size={18} className="mt-1 shrink-0" />
            <p>
              Keep this page open while a batch runs on free hosting. Progress
              is saved; reopen and resume interrupted work. Pausing prevents new
              work; a page already being checked may finish. Source restrictions
              and robots.txt are respected. No emails are sent.
            </p>
          </div>
          <section className="panel mb-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="text-sm font-semibold">
                  Choose a research batch
                </h2>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Unverified, non-excluded leads · up to 25 per batch
                </p>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  setPage(1);
                  setQ(String(values.get("q") || ""));
                }}
              >
                <input
                  name="q"
                  aria-label="Search research leads"
                  placeholder="Business or phone"
                  maxLength={200}
                  className="h-9 text-xs"
                />
                <Button type="submit" variant="outline" size="sm">
                  <Search size={13} />
                  Search
                </Button>
              </form>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select visible leads"
                        checked={
                          data.leads.length > 0 &&
                          data.leads.every((l) => selected.includes(l.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? data.leads.map((l) => l.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>Business / phone</th>
                    <th>Website</th>
                    <th>Research route</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${l.phone}`}
                          checked={selected.includes(l.id)}
                          onChange={() => toggle(l.id)}
                        />
                      </td>
                      <td>
                        <p className="font-medium">
                          {l.businessName || "Business not yet identified"}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-zinc-400">
                          {l.phone}
                        </p>
                      </td>
                      <td className="max-w-56 truncate text-zinc-500">
                        {l.website || "Not supplied"}
                      </td>
                      <td className="text-[11px] text-zinc-500">
                        {l.website
                          ? "Check supplied website"
                          : data.config.searchConfigured
                            ? "Search by phone"
                            : "Search key required"}
                      </td>
                    </tr>
                  ))}
                  {!data.leads.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-zinc-400"
                      >
                        No matching unverified leads.{" "}
                        <Link href="/leads" className="text-emerald-700">
                          Open your lead directory
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-[11px] text-zinc-400">
              <span>
                {data.count} eligible leads · {selected.length} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Previous research page"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={13} />
                </Button>
                {data.page} / {data.pages}
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Next research page"
                  disabled={page >= data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 bg-zinc-50/40 p-5">
              <label className="flex max-w-lg items-start gap-2 text-[11px] leading-5 text-zinc-500">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                />
                I have reviewed the source permissions for this research. A
                public email is not automatic permission to send marketing.
              </label>
              <Button
                disabled={busy || !selected.length || !acknowledge}
                onClick={() =>
                  action({
                    action: "create",
                    leadIds: selected,
                    acknowledge: true,
                  })
                }
              >
                <ScanSearch size={14} />
                {busy
                  ? "Starting…"
                  : `Research ${selected.length || "selected"} leads`}
              </Button>
            </div>
          </section>
          <section className="panel mb-6 p-5">
            <div className="mb-4 flex items-center justify-end gap-2 text-[10px] text-zinc-400">
              <Button
                variant="outline"
                size="sm"
                aria-label="Newer research batches"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage(historyPage - 1)}
              >
                <ChevronLeft size={12} />
              </Button>
              Batch history {data.historyPage} / {data.historyPages}
              <Button
                variant="outline"
                size="sm"
                aria-label="Older research batches"
                disabled={historyPage >= data.historyPages}
                onClick={() => setHistoryPage(historyPage + 1)}
              >
                <ChevronRight size={12} />
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Agent control center</h2>
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  Saved batches, evidence, retries, and source-access logs
                </p>
              </div>
              {data.batches.length > 0 && (
                <select
                  aria-label="Research batch"
                  value={activeId}
                  onChange={(e) => {
                    setActiveId(e.target.value);
                    setAuto(true);
                  }}
                  className="max-w-full text-xs"
                >
                  {data.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.createdAt.replace("T", " ").slice(0, 16)} UTC ·{" "}
                      {b.jobs.length} leads · {b.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {active ? (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">
                    {progress} / {active.jobs.length} processed ·{" "}
                    <strong className="font-medium text-zinc-700">
                      {active.status}
                    </strong>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {active.status === "running" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action({ action: "pause", batchId: activeId })
                        }
                      >
                        <Pause size={13} />
                        Pause batch
                      </Button>
                    ) : active.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action({ action: "resume", batchId: activeId })
                        }
                      >
                        <Play size={13} />
                        Resume batch
                      </Button>
                    ) : null}
                    {!auto && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAuto(true);
                          setError("");
                        }}
                      >
                        Resume page processing
                      </Button>
                    )}
                    {active.jobs.some((j) =>
                      ["failed", "blocked"].includes(j.status),
                    ) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action({ action: "retry", batchId: activeId })
                        }
                      >
                        <RefreshCw size={13} />
                        Retry failed / blocked
                      </Button>
                    )}
                  </div>
                </div>
                <div className="my-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{
                      width: `${(progress / Math.max(active.jobs.length, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="space-y-4">
                  {active.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl border border-zinc-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold">
                            {job.lead.businessName || job.lead.phone}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-zinc-400">
                            {job.lead.phone}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] ${job.status === "running" ? "bg-blue-50 text-blue-700" : job.status === "completed" ? "bg-emerald-50 text-emerald-700" : job.status === "failed" || job.status === "blocked" ? "bg-amber-50 text-amber-800" : "bg-zinc-100 text-zinc-500"}`}
                        >
                          {job.status === "completed"
                            ? job.candidates.length
                              ? "Findings ready"
                              : "Unresolved"
                            : job.status}{" "}
                          · attempt {job.attempts}/3
                        </span>
                      </div>
                      {job.error && (
                        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                          {job.error}
                        </p>
                      )}
                      {job.candidates.map((candidate) => (
                        <FindingCard
                          key={candidate.id}
                          candidate={candidate}
                          refresh={async () => {
                            await load();
                            router.refresh();
                          }}
                        />
                      ))}
                      <details className="mt-4 text-[11px] text-zinc-500">
                        <summary className="cursor-pointer">
                          Research log ({job.logs.length} recent entries)
                        </summary>
                        <ul className="mt-3 space-y-2 border-l border-zinc-200 pl-3">
                          {[...job.logs].reverse().map((log) => (
                            <li key={log.id}>
                              <span className="mr-2 font-mono text-[9px] text-zinc-400">
                                {log.createdAt.slice(11, 19)} UTC
                              </span>
                              {log.message}
                            </li>
                          ))}
                          {!job.logs.length && (
                            <li>Waiting for the job to start.</li>
                          )}
                        </ul>
                      </details>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <ScanSearch
                  size={30}
                  strokeWidth={1.4}
                  className="text-zinc-300"
                />
                <p className="mt-4 text-sm font-medium">
                  Your research starts with a small batch.
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  Select a few contacts above and review their findings here.
                </p>
              </div>
            )}
          </section>
          <section className="panel overflow-hidden">
            <div className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Mail size={16} className="text-emerald-700" />
                Reviewed email discoveries
              </h2>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Latest 25 source-attributed emails saved after your review.
                Publication does not verify deliverability or marketing
                eligibility.
              </p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Source / discovery date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.discovered.map((l) => (
                    <tr key={l.id}>
                      <td>{l.businessName || "Business name not supplied"}</td>
                      <td className="whitespace-nowrap font-mono text-[11px]">
                        {l.phone}
                      </td>
                      <td>{l.email}</td>
                      <td>
                        {l.sourceUrl && (
                          <a
                            href={l.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700"
                          >
                            View source
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <p className="mt-1 text-[10px] text-zinc-400">
                          {l.discoveredAt?.slice(0, 10)}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {!data.discovered.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-zinc-400"
                      >
                        No discovered emails have been approved yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-4 text-[10px] leading-5 text-zinc-400">
            The request counter reserves each attempted search, including
            retries and provider failures. Provider billing can differ. No AI
            model is used for this research. Supplied websites are checked
            directly; source restrictions can leave a lead unresolved.
          </p>
        </>
      )}
    </>
  );
}
function FindingCard({
  candidate,
  refresh,
}: {
  candidate: Candidate;
  refresh: () => Promise<void>;
}) {
  const parsed = candidateEvidence.safeParse(candidate.evidence);
  const evidence = parsed.success ? parsed.data : null;
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/research/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          action,
          email: email || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {candidate.businessName ||
              "Business name not declared on checked pages"}
          </h3>
          <a
            href={candidate.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-[11px] text-emerald-700"
          >
            {candidate.website}
            <ExternalLink size={11} className="shrink-0" />
          </a>
        </div>
        <span
          title="A deterministic evidence score, not a statistical probability."
          className="rounded-md bg-white px-2 py-1 text-[10px] text-zinc-500"
        >
          Evidence score {candidate.confidence}/100
        </span>
      </div>
      <p
        className={`mt-3 flex items-center gap-1.5 text-[11px] ${candidate.phoneMatched ? "text-emerald-800" : "text-amber-800"}`}
      >
        {candidate.phoneMatched ? (
          <CheckCircle2 size={13} />
        ) : (
          <CircleHelp size={13} />
        )}{" "}
        {candidate.phoneMatched
          ? "Exact phone number found on checked pages"
          : "Phone match unverified — cannot approve as a verified business"}
      </p>
      {evidence?.services && (
        <p className="mt-3 text-xs leading-6 text-zinc-500">
          Published description: {evidence.services}
        </p>
      )}
      <div className="my-4 space-y-2">
        {evidence?.pages.map((p) => (
          <div
            key={p.url}
            className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400"
          >
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full break-all text-emerald-700 underline"
            >
              {p.title || p.url}
            </a>
            <span>
              Checked {p.discoveredAt.slice(0, 10)} ·{" "}
              {p.phoneMatched ? "phone matches" : "no phone match"}
            </span>
          </div>
        ))}
      </div>
      {candidate.decision ? (
        <p className="text-xs font-medium text-zinc-600">
          Review recorded: {candidate.decision}
        </p>
      ) : (
        <>
          <label className="block text-[11px] text-zinc-500">
            Published email to save
            <select
              aria-label={`Email for ${candidate.website}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full text-xs"
            >
              <option value="">
                Verify business only — leave existing email unchanged
              </option>
              {evidence?.emails.map((e) => (
                <option value={e.email} key={e.email}>
                  {e.email} · {new URL(e.sourceUrl).pathname}
                </option>
              ))}
            </select>
          </label>
          {!evidence?.emails.length && (
            <p className="mt-2 text-[11px] text-zinc-400">
              No public contact email found on the checked pages. No address was
              guessed.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !candidate.phoneMatched || !evidence}
              onClick={() => review("approve")}
            >
              <CheckCircle2 size={13} />
              {busy
                ? "Saving…"
                : email
                  ? "Confirm business & save email"
                  : "Confirm business match"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => review("reject")}
            >
              <X size={13} />
              Reject finding
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
