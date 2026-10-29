"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Download,
  Users,
  ArrowUpRight,
  X,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Globe,
  Phone,
  Mail,
} from "lucide-react";
import { ImportDialog } from "./import-dialog";
import { Button } from "./ui/button";
import type { Lead } from "@prisma/client";
type ClientLead = Omit<
  Lead,
  "createdAt" | "updatedAt" | "lastContactAt" | "verifiedAt" | "discoveredAt"
> & { createdAt: string; lastContactAt: string | null };
export function LeadTable({
  leads,
  count,
  page,
  pages,
  q,
  status,
  total,
}: {
  leads: ClientLead[];
  count: number;
  page: number;
  pages: number;
  q: string;
  status: string;
  total: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ClientLead | null>(null);
  function url(p: number) {
    const search = new URLSearchParams({ q, status, page: String(p) });
    return `/leads?${search}`;
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow text-emerald-700">
            YOUR CREATIVE PIPELINE
          </span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
            Every lead, a possibility.
          </h1>
          <p className="mt-2 text-xs text-zinc-500">
            Organize, review, and get to know your next potential client.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-3">
          <Button variant="outline" asChild>
            <a href="/api/leads/export">
              <Download size={14} />
              Export CSV
            </a>
          </Button>
          <ImportDialog />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="panel flex min-w-44 items-center gap-3 px-5 py-4">
          <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Users size={18} />
          </span>
          <div>
            <p className="text-xl font-semibold">{total.toLocaleString()}</p>
            <p className="mt-0.5 text-[10px] text-zinc-400">
              Total imported leads
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 text-[11px] leading-5 text-emerald-800">
          <ShieldAlert size={18} className="shrink-0" />
          Imported details are unverified. A valid phone or email format does
          not establish business identity or permission to send marketing.
        </div>
      </div>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="text-sm font-semibold">
            Lead directory{" "}
            <span className="ml-2 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-normal text-zinc-500">
              {count}
            </span>
          </h2>
          <form action="/leads" className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-3 text-zinc-400"
              />
              <input
                key={q}
                name="q"
                defaultValue={q}
                maxLength={200}
                aria-label="Search leads"
                placeholder="Search name, phone, email…"
                className="h-9 w-full pl-9 text-xs sm:w-60"
              />
            </div>
            <select
              name="status"
              key={status}
              defaultValue={status}
              aria-label="Filter leads"
              className="h-9 text-xs"
            >
              <option value="">All leads</option>
              <option value="unresolved">Unresolved</option>
              <option value="manual_review">Needs review</option>
              <option value="verified">Verified business</option>
              <option value="has_email">Has email</option>
              <option value="do_not_contact">Do not contact</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
          </form>
        </div>
        {leads.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Business / contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Industry</th>
                  <th>Research status</th>
                  <th>Outreach</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-zinc-50/60">
                    <td>
                      <button
                        onClick={() => setSelected(lead)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eff4f1] text-xs font-semibold text-emerald-800">
                          {lead.businessName?.[0]?.toUpperCase() || (
                            <Phone size={14} />
                          )}
                        </span>
                        <span className="max-w-44 truncate">
                          <span className="font-medium">
                            {lead.businessName || "Unidentified business"}
                          </span>
                          <span className="mt-1 block text-[10px] text-zinc-400">
                            {[lead.state, lead.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap font-mono text-[11px] text-zinc-500">
                      {lead.phone}
                    </td>
                    <td className="max-w-52 truncate text-zinc-500">
                      {lead.email || (
                        <span className="text-zinc-300">Not provided</span>
                      )}
                    </td>
                    <td className="text-zinc-500">{lead.industry || "—"}</td>
                    <td>
                      <span
                        className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] ${lead.researchStatus === "verified" ? "bg-emerald-50 text-emerald-700" : lead.researchStatus === "manual_review" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-700"}`}
                      >
                        {lead.researchStatus === "verified"
                          ? "Verified business"
                          : lead.researchStatus === "manual_review"
                            ? "Needs review"
                            : "Unresolved"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`whitespace-nowrap text-[10px] ${lead.outreachStatus === "do_not_contact" ? "text-red-600" : "text-zinc-400"}`}
                      >
                        {lead.outreachStatus === "do_not_contact"
                          ? "Do not contact"
                          : lead.outreachStatus === "manual_review"
                            ? "Review history"
                            : "Not contacted"}
                      </span>
                    </td>
                    <td>
                      <button
                        aria-label={`Edit ${lead.businessName || lead.phone}`}
                        onClick={() => setSelected(lead)}
                        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-700"
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <Users size={30} strokeWidth={1.3} className="text-zinc-400" />
            </div>
            <h3 className="text-base font-semibold">
              {q || status
                ? "No leads match these filters"
                : "Your next chapter starts here"}
            </h3>
            <p className="mb-5 mt-2 max-w-sm text-xs leading-6 text-zinc-400">
              {q || status
                ? "Try another name, phone number, or status."
                : "Import your contacts to start building a thoughtful pipeline. A list of phone numbers is all you need."}
            </p>
            {q || status ? (
              <Button variant="outline" asChild>
                <Link href="/leads">Clear filters</Link>
              </Button>
            ) : (
              <ImportDialog />
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4 text-[11px] text-zinc-400">
          <p>
            {count
              ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, count)} of ${count} leads`
              : "No leads to display"}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => router.push(url(page - 1))}
              aria-label="Previous page"
              className="size-7"
            >
              <ChevronLeft size={13} />
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= pages}
              onClick={() => router.push(url(page + 1))}
              aria-label="Next page"
              className="size-7"
            >
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </section>
      {selected && (
        <LeadEditor
          key={selected.id}
          lead={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function LeadEditor({
  lead,
  onClose,
}: {
  lead: ClientLead;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          doNotContact:
            fields.doNotContact === "on" ||
            lead.outreachStatus === "do_not_contact",
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save lead.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="lead-title"
      className="w-[min(600px,calc(100vw-32px))] max-h-[90vh]"
    >
      <form onSubmit={save}>
        <div className="flex items-center justify-between border-b border-zinc-100 p-6">
          <div>
            <span className="eyebrow text-emerald-700">LEAD DETAILS</span>
            <h2 id="lead-title" className="mt-2 text-xl font-semibold">
              {lead.businessName || "Unidentified business"}
            </h2>
            <p className="mt-2 flex items-center gap-2 font-mono text-xs text-zinc-400">
              <Phone size={12} />
              {lead.phone}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close lead"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-lg bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
            These details are manually supplied and unverified. Saving keeps
            this lead in the review queue.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                name: "businessName",
                label: "Business name",
                value: lead.businessName,
              },
              {
                name: "email",
                label: "Email address",
                value: lead.email,
                type: "email",
              },
              { name: "website", label: "Website", value: lead.website },
              { name: "industry", label: "Industry", value: lead.industry },
              { name: "state", label: "State / region", value: lead.state },
              { name: "source", label: "Lead source", value: lead.source },
            ].map((f) => (
              <label className="text-xs font-medium" key={f.name}>
                {f.label}
                <input
                  name={f.name}
                  type={f.type || "text"}
                  defaultValue={f.value || ""}
                  maxLength={f.name === "email" ? 254 : 2000}
                  className="mt-2 w-full text-xs"
                />
              </label>
            ))}
          </div>
          <label className="block text-xs font-medium">
            Notes
            <textarea
              name="notes"
              defaultValue={lead.notes || ""}
              maxLength={5000}
              rows={3}
              className="mt-2 w-full text-xs"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3 text-[10px] leading-5 text-zinc-500">
            <p>Imported: {lead.createdAt.slice(0, 10)}</p>
            <p>
              Last contact: {lead.lastContactAt?.slice(0, 10) || "Not recorded"}
            </p>
            <p className="col-span-2 break-all">
              Source evidence: {lead.sourceUrl || "No source URL provided"}
            </p>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/40 p-3">
            <input
              type="checkbox"
              name="doNotContact"
              defaultChecked={lead.outreachStatus === "do_not_contact"}
              disabled={lead.outreachStatus === "do_not_contact"}
              className="mt-0.5"
            />
            <span>
              <span className="text-xs font-medium text-red-800">
                Do not contact this lead
              </span>
              <span className="mt-1 block text-[10px] leading-5 text-red-700/70">
                Exclude from outreach and add its email to your suppression
                list. Existing exclusions cannot be cleared here.
              </span>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-100 p-5">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save lead"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
