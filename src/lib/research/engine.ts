import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ProxyAgent } from "undici";
import { fetch as proxyFetch } from "undici";
import { z } from "zod";
import {
  crawler,
  publicUrl,
  ResearchError,
  type WebResponse,
} from "./safe-web";
import { extractPage, type Finding } from "./extract";
export type ResearchLead = {
  phone: string;
  country: string;
  website: string | null;
};
export type ResearchDependencies = {
  search: (query: string, signal: AbortSignal) => Promise<string[]>;
  page: (url: string) => Promise<WebResponse>;
  log: (stage: string, message: string) => Promise<void>;
};
const directories =
  /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|yelp\.com|google\.com|bing\.com|yellowpages\.com|tripadvisor\.com|bbb\.org|mapquest\.com|whitepages\.com)$/;
export async function braveSearch(query: string, signal: AbortSignal) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key)
    throw new ResearchError(
      "Phone-only lookup needs BRAVE_SEARCH_API_KEY in Render's environment settings.",
    );
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
  try {
    const response = await proxyFetch(url, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
      signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ResearchError(
        response.status === 401 || response.status === 403
          ? "Search provider rejected the configured key or plan. Check your Brave account."
          : `Search provider returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new ResearchError("Search provider returned no results body.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 256 * 1024) {
        await reader.cancel();
        throw new ResearchError("Search response exceeded the size limit.");
      }
      chunks.push(value);
    }
    const data = z
      .object({
        web: z
          .object({ results: z.array(z.object({ url: z.string() })).max(20) })
          .optional(),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return data.web?.results.map((r) => r.url) || [];
  } finally {
    await dispatcher?.close();
  }
}
export async function investigate(
  lead: ResearchLead,
  signal: AbortSignal,
  dependencies?: Partial<ResearchDependencies>,
): Promise<Finding[]> {
  const log = dependencies?.log || (async () => {});
  const page = dependencies?.page || crawler(signal);
  const search = dependencies?.search || braveSearch;
  let urls: string[] = [];
  if (lead.website) {
    urls.push(lead.website);
    await log(
      "website",
      "Checking the supplied business website; imported information is not treated as verified.",
    );
  } else {
    const national =
      parsePhoneNumberFromString(lead.phone)?.formatNational() || lead.phone;
    await log("search", "Requesting a quoted phone-number business search.");
    urls = await search(
      `"${lead.phone}" OR "${national}" business contact`,
      signal,
    );
  }
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const raw of urls) {
    try {
      const url = publicUrl(raw);
      if (directories.test(url.hostname) || seen.has(url.hostname)) continue;
      seen.add(url.hostname);
      candidates.push(url.toString());
    } catch {}
    if (candidates.length === 2) break;
  }
  const findings: Finding[] = [];
  let transient: ResearchError | undefined;
  for (const url of candidates) {
    signal.throwIfAborted();
    try {
      await log(
        "website",
        `Checking public pages at ${new URL(url).hostname}.`,
      );
      const home = await page(url);
      const first = extractPage(home.body, home.url, lead.phone, lead.country);
      const pages = [first.evidence];
      for (const contact of first.contactLinks) {
        try {
          const response = await page(contact);
          if (new URL(response.url).origin !== new URL(home.url).origin) {
            await log(
              "access",
              "Contact page redirected to another origin; its emails were not attributed to this business.",
            );
            continue;
          }
          pages.push(
            extractPage(response.body, response.url, lead.phone, lead.country)
              .evidence,
          );
        } catch (error) {
          await log(
            "access",
            error instanceof ResearchError
              ? error.message
              : "Contact page could not be checked.",
          );
        }
      }
      const phoneMatched = pages.some((p) => p.phoneMatched);
      const emails = [
        ...new Map(
          pages.flatMap((p) =>
            p.emails.map(
              (email) =>
                [
                  email,
                  { email, sourceUrl: p.url, discoveredAt: p.discoveredAt },
                ] as const,
            ),
          ),
        ).values(),
      ];
      const confidence = phoneMatched
        ? 80 + (first.businessName ? 5 : 0) + (emails.length ? 5 : 0)
        : 20 + (first.businessName ? 5 : 0);
      findings.push({
        businessName: first.businessName,
        website: new URL(home.url).origin,
        phoneMatched,
        confidence,
        evidence: { pages, emails, services: first.description },
      });
      await log(
        "findings",
        phoneMatched
          ? `Exact phone match on a checked page; ${emails.length} published email(s) found. Human review is required.`
          : "No exact phone match on checked pages. This business remains unverified.",
      );
    } catch (error) {
      const failure =
        error instanceof ResearchError
          ? error
          : new ResearchError(
              "Source could not be checked within the research time limit.",
              true,
            );
      await log("access", failure.message);
      if (failure.retryable) transient = failure;
    }
  }
  if (!findings.length && transient) throw transient;
  await log(
    "complete",
    findings.length
      ? "Findings saved for manual review. No lead details were automatically verified."
      : "No reliable accessible website match found. Lead remains unresolved.",
  );
  return findings;
}
