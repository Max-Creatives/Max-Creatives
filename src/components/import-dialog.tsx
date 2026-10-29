"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  X,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Download,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import type { parseLeadCsv } from "@/lib/csv";
type Preview = ReturnType<typeof parseLeadCsv> & { committed: boolean };
function exportCell(value: string) {
  return `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
}
export function ImportDialog({
  compact = false,
  label = "Import leads",
}: {
  compact?: boolean;
  label?: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [file, setFile] = useState<{ fileName: string; csv: string } | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  function close() {
    if (busy) return;
    setOpen(false);
    if (done) router.refresh();
  }
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    setPreview(null);
    setDone(false);
    setFile(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Your file is larger than 2 MB. Split it into smaller batches.");
      return;
    }
    setBusy(true);
    try {
      const payload = { fileName: file.name, csv: await file.text() };
      setFile(payload);
      await request(payload, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  }
  async function request(
    payload: { fileName: string; csv: string },
    commit: boolean,
  ) {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, commit }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    setPreview(result);
    if (commit) {
      setDone(true);
      router.refresh();
    }
  }
  async function commit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await request(file, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  function report() {
    if (!preview) return;
    const text = [
      ["CSV row", "Phone", "Result", "Errors", "Warnings"],
      ...preview.rows.map((r) => [
        String(r.row),
        r.rawPhone,
        r.status,
        r.errors.join("; "),
        r.warnings.join("; "),
      ]),
    ]
      .map((row) => row.map(exportCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Button
        size={compact ? "sm" : "default"}
        onClick={() => {
          setDone(false);
          setPreview(null);
          setFile(null);
          setError("");
          setOpen(true);
        }}
      >
        <Upload size={14} />
        {label}
      </Button>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        aria-labelledby={titleId}
        className="w-[min(800px,calc(100vw-32px))] max-h-[90vh]"
      >
        <div className="flex items-start justify-between border-b border-zinc-100 p-6">
          <div>
            <span className="eyebrow text-emerald-700">Grow your pipeline</span>
            <h2 id={titleId} className="mt-2 text-xl font-semibold">
              {done ? "Your leads are in." : "Import your leads"}
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              A little organization. A lot of potential.
            </p>
          </div>
          <button
            disabled={busy}
            aria-label="Close import"
            onClick={close}
            className="rounded p-1 hover:bg-zinc-100"
          >
            <X size={19} />
          </button>
        </div>
        <div className="space-y-5 p-6">
          {done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
              <h3 className="mt-3 text-lg font-semibold">
                {preview?.ready} leads imported
              </h3>
              <p className="mt-2 text-xs leading-6 text-emerald-800">
                {preview?.duplicates} duplicates skipped · {preview?.invalid}{" "}
                invalid rows excluded.
                <br />
                Imported information is unverified and ready for review.
              </p>
            </div>
          ) : (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!busy) void choose(e.dataTransfer.files[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-7 text-center ${dragging ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 bg-zinc-50/60"}`}
              >
                <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-emerald-700">
                  {busy ? (
                    <LoaderCircle size={22} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={22} />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {file?.fileName || "Drop your CSV file here"}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Up to 2 MB · 2,000 rows per import
                </p>
                <input
                  ref={input}
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="Upload leads CSV"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  {busy
                    ? "Validating…"
                    : file
                      ? "Choose another file"
                      : "Choose file"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <p className="text-zinc-500">
                  Phone-only files and{" "}
                  <span className="font-medium text-zinc-700">
                    cleaned_outreach_leads.csv
                  </span>{" "}
                  supported.
                </p>
                <a
                  href="/lead-import-template.csv"
                  download
                  className="flex items-center gap-1 text-emerald-700"
                >
                  <Download size={12} />
                  CSV template
                </a>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-[11px] leading-5 text-blue-900">
                US numbers are normalized to E.164. Existing phones and emails
                are skipped. Business details and public emails remain
                unverified; imported status labels do not establish verification
                or delivery.
              </div>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </p>
          )}
          {preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Ready to import", preview.ready, "text-emerald-700"],
                  ["Duplicates", preview.duplicates, "text-amber-700"],
                  ["Invalid rows", preview.invalid, "text-red-600"],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-zinc-200 p-3"
                  >
                    <p className="text-[10px] text-zinc-500">{label}</p>
                    <p className={`mt-1 text-xl font-semibold ${color}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              {preview.ignoredColumns.length > 0 && (
                <p className="text-xs text-amber-700">
                  Ignored columns: {preview.ignoredColumns.join(", ")}
                </p>
              )}
              <div className="max-h-56 overflow-auto rounded-lg border border-zinc-200">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Phone / business</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>
                          <span className="whitespace-nowrap">
                            {row.lead?.phone || row.rawPhone || "Missing phone"}
                          </span>
                          <p className="mt-1 text-zinc-400">
                            {row.lead?.businessName}
                          </p>
                        </td>
                        <td
                          className={
                            row.status === "ready"
                              ? "text-emerald-700"
                              : row.status === "invalid"
                                ? "text-red-600"
                                : "text-amber-700"
                          }
                        >
                          {row.status}
                        </td>
                        <td className="min-w-48 text-zinc-500">
                          {[...row.errors, ...row.warnings].join(" ") ||
                            "Valid format; not verified."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.total > 100 && (
                <p className="text-xs text-zinc-400">
                  Showing the first 100 of {preview.total} rows. Download the
                  report for every result.
                </p>
              )}
              <button
                onClick={report}
                className="flex items-center gap-1 text-xs text-emerald-700"
              >
                <Download size={13} />
                Download validation report
              </button>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-100 p-5">
          <Button variant="outline" disabled={busy} onClick={close}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done && (
            <Button disabled={!preview?.ready || busy} onClick={commit}>
              {busy ? "Working…" : `Import ${preview?.ready || 0} valid leads`}
              <ArrowRight size={14} />
            </Button>
          )}
          {done && (
            <Button
              onClick={() => {
                setOpen(false);
                router.push("/leads");
                router.refresh();
              }}
            >
              View leads
              <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
