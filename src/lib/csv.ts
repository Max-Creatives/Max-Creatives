import Papa from "papaparse";
import {
  parsePhoneNumberFromString,
  type CountryCode,
  isSupportedCountry,
} from "libphonenumber-js";
import { z } from "zod";
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;
export type LeadInput = {
  phone: string;
  businessName: string | null;
  website: string | null;
  email: string | null;
  industry: string | null;
  country: string;
  state: string | null;
  source: string | null;
  sourceUrl: string | null;
  researchStatus: string;
  outreachStatus: string;
  lastContactAt: Date | null;
  notes: string | null;
};
export type ImportRow = {
  row: number;
  lead: LeadInput | null;
  status: "ready" | "duplicate" | "invalid";
  errors: string[];
  warnings: string[];
  rawPhone: string;
};
const aliases: Record<string, string> = {
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  mobile: "phone",
  businessphone: "phone",
  businessname: "businessName",
  company: "businessName",
  companyname: "businessName",
  business: "businessName",
  website: "website",
  url: "website",
  email: "email",
  emailaddress: "email",
  industry: "industry",
  country: "country",
  state: "state",
  leadsource: "source",
  source: "source",
  sourceurl: "sourceUrl",
  researchstatus: "researchStatus",
  outreachstatus: "outreachStatus",
  lastcontactdate: "lastContactAt",
  lastcontactat: "lastContactAt",
  notes: "notes",
};
const canonical = (s: string) =>
  s
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function normalizePhone(raw: string, country = "US") {
  raw = raw.replace(/^'(?=\+)/, "");
  if (!/^[+()\d\s.\-]+$/.test(raw)) return null;
  const parsed = parsePhoneNumberFromString(raw, country as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}
export function safeWebsite(raw: string) {
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      url.hostname === "localhost"
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
export function parseLeadCsv(
  csv: string,
  existingPhones = new Set<string>(),
  existingEmails = new Set<string>(),
) {
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES)
    throw new Error("CSV exceeds the 2 MB limit.");
  const parsed = Papa.parse<string[]>(csv, {
    skipEmptyLines: "greedy",
    delimiter: ",",
  });
  if (parsed.errors.length)
    throw new Error(`CSV could not be parsed: ${parsed.errors[0].message}`);
  if (!parsed.data.length) throw new Error("CSV is empty.");
  let headers = parsed.data[0].map((h) => aliases[canonical(h)] ?? "");
  const headerless =
    parsed.data[0].length === 1 &&
    normalizePhone(parsed.data[0][0].trim()) !== null;
  if (headerless) headers = ["phone"];
  if (!headers.includes("phone"))
    throw new Error(
      "A Phone or Phone number column is required. A headerless file may contain one phone number per row.",
    );
  const known = headers.filter(Boolean);
  if (new Set(known).size !== known.length)
    throw new Error(
      "Multiple columns map to the same field. Keep one column per field.",
    );
  const data = headerless ? parsed.data : parsed.data.slice(1);
  if (!data.length) throw new Error("CSV has a header but no lead rows.");
  if (data.length > MAX_CSV_ROWS)
    throw new Error(
      `Import up to ${MAX_CSV_ROWS.toLocaleString()} rows at a time.`,
    );
  const phones = new Set(existingPhones),
    emails = new Set(existingEmails);
  const rows: ImportRow[] = data.map((values, index) => {
    const row = index + (headerless ? 1 : 2),
      errors: string[] = [],
      warnings: string[] = [];
    const fields: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) fields[header] = (values[i] ?? "").trim();
    });
    if (values.length !== headers.length)
      errors.push("Column count differs from the header.");
    if (Object.values(fields).some((v) => v.length > 5000))
      errors.push("A field exceeds 5,000 characters.");
    let country = (fields.country || "US").toUpperCase();
    if (["USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(country))
      country = "US";
    if (!isSupportedCountry(country)) {
      errors.push("Use a supported two-letter country code (for example US).");
      country = "US";
    }
    const phone = normalizePhone(fields.phone || "", country);
    if (!phone)
      errors.push(
        "Invalid phone number; use a valid national or E.164 number.",
      );
    const email = fields.email?.toLowerCase() || null;
    if (email && (!z.email().safeParse(email).success || email.length > 254))
      errors.push("Invalid email address.");
    const website = fields.website ? safeWebsite(fields.website) : null;
    if (fields.website && !website)
      errors.push("Invalid website; use an HTTP or HTTPS domain.");
    const sourceUrl = fields.sourceUrl ? safeWebsite(fields.sourceUrl) : null;
    if (fields.sourceUrl && !sourceUrl) errors.push("Invalid source URL.");
    let lastContactAt: Date | null = null;
    if (fields.lastContactAt) {
      const date = fields.lastContactAt;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        errors.push("Last contact date must be a valid YYYY-MM-DD date.");
      else lastContactAt = new Date(date);
    }
    if (
      fields.researchStatus &&
      !["unresolved", "manual_review"].includes(fields.researchStatus)
    )
      warnings.push(
        "Imported research status requires review; no verification is assumed.",
      );
    if (
      fields.outreachStatus &&
      !["not_contacted", "do_not_contact"].includes(fields.outreachStatus)
    )
      warnings.push(
        "Imported outreach status requires review; no delivery is assumed.",
      );
    const suppliedDetails = !!(fields.businessName || email || website);
    const lead: LeadInput | null = phone
      ? {
          phone,
          businessName: fields.businessName || null,
          website,
          email,
          industry: fields.industry || null,
          country,
          state: fields.state || null,
          source: fields.source || null,
          sourceUrl,
          lastContactAt,
          researchStatus:
            suppliedDetails || fields.researchStatus === "manual_review"
              ? "manual_review"
              : "unresolved",
          outreachStatus:
            fields.outreachStatus === "do_not_contact"
              ? "do_not_contact"
              : lastContactAt ||
                  (fields.outreachStatus &&
                    fields.outreachStatus !== "not_contacted")
                ? "manual_review"
                : "not_contacted",
          notes: fields.notes || null,
        }
      : null;
    let status: ImportRow["status"] = "ready";
    if (errors.length) status = "invalid";
    else if (phone && (phones.has(phone) || (email && emails.has(email)))) {
      status = "duplicate";
      warnings.push(
        "Phone or email already exists in this file or your workspace.",
      );
    }
    if (status === "ready" && phone) {
      phones.add(phone);
      if (email) emails.add(email);
    }
    return {
      row,
      lead,
      status,
      errors,
      warnings,
      rawPhone: fields.phone || "",
    };
  });
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    rows,
    ignoredColumns: headerless
      ? []
      : parsed.data[0].filter((_, i) => !headers[i]),
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  // Prevent spreadsheet formula execution in exported reports.
  const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
