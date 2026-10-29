import { pageUser } from "@/lib/auth";
import { workspaceStats } from "@/lib/queries";
import { db } from "@/lib/db";
import { BarChart3, CheckCircle2, Clock3 } from "lucide-react";
export const metadata = { title: "Analytics" };
export default async function Analytics() {
  const user = await pageUser();
  const [stats, audit, batches] = await Promise.all([
    workspaceStats(user.id),
    db.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    db.importBatch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 30,
    }),
  ]);
  const max = Math.max(1, ...batches.map((b) => b.imported));
  return (
    <>
      <span className="eyebrow text-emerald-700">A CLEARER PICTURE</span>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        See your pipeline take shape.
      </h1>
      <p className="mb-7 mt-2 text-xs text-zinc-500">
        Real workspace activity. No estimated engagement or invented results.
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Import batches", stats.imports],
          ["Leads imported", stats.total],
          ["Needs review", stats.review],
          ["Excluded leads", stats.excluded],
        ].map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-4 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-sm font-semibold">Import activity</h2>
          <p className="mt-2 text-[11px] text-zinc-400">
            First 30 import batches · valid leads saved per batch
          </p>
          {batches.length ? (
            <div
              role="img"
              aria-label={batches
                .map((b) => `${b.fileName}: ${b.imported} leads`)
                .join("; ")}
              className="mt-10 flex h-56 items-end gap-3 overflow-x-auto border-b border-zinc-200 pb-6"
            >
              {batches.map((b) => (
                <div
                  key={b.id}
                  className="relative flex h-full min-w-10 flex-1 flex-col justify-end text-center"
                >
                  <span className="mb-2 text-[10px] text-emerald-800">
                    {b.imported}
                  </span>
                  <div
                    title={`${b.fileName}: ${b.imported} imported`}
                    className="rounded-t bg-emerald-500/80"
                    style={{
                      height: `${(b.imported / max) * 80}%`,
                      minHeight: 2,
                    }}
                  />
                  <span className="absolute -bottom-5 w-full text-[8px] text-zinc-400">
                    {b.createdAt.toISOString().slice(5, 10)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-zinc-300">
              <BarChart3 size={35} strokeWidth={1.3} />
              <p className="mt-4 text-xs text-zinc-400">
                Your import history will appear here.
              </p>
            </div>
          )}
          <p className="mt-6 rounded-lg bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-400">
            AI usage: $0 · No AI requests are made in Phase 1. Email and revenue
            analytics require future integrations.
          </p>
        </section>
        <section className="panel p-6">
          <h2 className="text-sm font-semibold">Workspace audit trail</h2>
          <p className="mb-4 mt-2 text-[11px] text-zinc-400">
            Your latest 15 recorded actions · timestamps in UTC
          </p>
          {audit.map((a) => (
            <div
              key={a.id}
              className="flex gap-3 border-b border-zinc-100 py-3 last:border-0"
            >
              <span className="mt-0.5 text-emerald-600">
                <CheckCircle2 size={14} />
              </span>
              <div>
                <p className="text-xs">
                  {a.action.replaceAll(".", " · ").replaceAll("_", " ")}
                </p>
                <p className="mt-1.5 text-[10px] text-zinc-400">
                  {a.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                </p>
              </div>
            </div>
          ))}
          {!audit.length && (
            <p className="py-10 text-xs text-zinc-400">
              No actions recorded yet.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
